import "server-only";

/**
 * Centralized client for LiteAPI (Nuitée's hotel booking API). This module
 * is marked server-only — importing it from a Client Component fails the
 * build rather than silently shipping LITEAPI_KEY (or a broken client-side
 * fetch) to the browser. Every route that needs LiteAPI data should call
 * through here, never fetch api.liteapi.travel directly.
 */

const BASE_URL = "https://api.liteapi.travel/v3.0";
const DEFAULT_TIMEOUT_MS = 4000;
const MIN_TIMEOUT_MS = 3000;
const MAX_TIMEOUT_MS = 10000;

export class LiteApiError extends Error {
  /** The upstream HTTP status, when the failure came from a response rather
   * than a timeout or network error. */
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "LiteApiError";
    this.status = status;
  }
}

export type LiteApiRequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  /** Appended as URL search params; undefined values are dropped. */
  query?: Record<string, string | number | boolean | undefined>;
  /** JSON-serialized and sent as the request body. */
  body?: unknown;
  /** Clamped to [3000, 10000]ms — default 4000ms. */
  timeoutMs?: number;
  /** Passed straight through to fetch's Next.js extension — lets a caller
   * opt a POST into the Data Cache (revalidate: N) instead of the default
   * uncached behaviour. Mainly for searchHotelRates: the sandbox key is
   * rate-limited to 5 req/window, and dev-mode effect double-invokes alone
   * can burn through that on a single page load without this. */
  next?: NextFetchRequestConfig;
};

/**
 * Makes an authenticated request to LiteAPI and returns the parsed JSON
 * response. Every call goes through here so the API key, base URL, and
 * timeout handling only ever live in one place.
 */
export async function liteApiRequest<T = unknown>(
  path: string,
  options: LiteApiRequestOptions = {},
): Promise<T> {
  const apiKey = process.env.LITEAPI_KEY;
  if (!apiKey) {
    throw new LiteApiError(
      "LITEAPI_KEY is not set — add it to .env.local and restart the dev server.",
    );
  }

  const { method = "GET", query, body, next } = options;
  const timeoutMs = Math.min(
    MAX_TIMEOUT_MS,
    Math.max(MIN_TIMEOUT_MS, options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
  );

  const url = new URL(path.replace(/^\/+/, ""), `${BASE_URL}/`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method,
      headers: {
        "X-API-Key": apiKey,
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
      ...(next ? { next } : {}),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new LiteApiError(
        `LiteAPI ${method} ${path} failed with ${response.status} ${response.statusText}${detail ? `: ${detail}` : ""}`,
        response.status,
      );
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof LiteApiError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new LiteApiError(
        `LiteAPI ${method} ${path} timed out after ${timeoutMs}ms.`,
      );
    }
    throw new LiteApiError(
      `LiteAPI ${method} ${path} failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  } finally {
    clearTimeout(timeout);
  }
}

/** GET /data/hotel?hotelId={hotelId} — a single hotel's static content. */
export function getHotel(hotelId: string, options?: { timeoutMs?: number }) {
  return liteApiRequest("/data/hotel", {
    query: { hotelId },
    timeoutMs: options?.timeoutMs,
  });
}

export type LiteApiHotelImage = {
  url: string;
  urlHd?: string;
  caption?: string;
  order?: number;
  defaultImage?: boolean;
};

/**
 * GET /data/hotel?hotelId={hotelId}, trimmed to just the photo gallery
 * (confirmed live: response is `{ data: { hotelImages: [...] } }`, up to
 * ~27 photos for a real sandbox hotel). Kept separate from getHotel() rather
 * than having callers dig the array out themselves, since a hotel-card
 * carousel only ever needs the URLs, not the full detail payload (rooms,
 * policies, reviews, ...).
 */
export async function getHotelImages(
  hotelId: string,
  options?: { timeoutMs?: number; next?: NextFetchRequestConfig },
): Promise<LiteApiHotelImage[]> {
  const response = await liteApiRequest<{
    data?: { hotelImages?: LiteApiHotelImage[] };
  }>("/data/hotel", {
    query: { hotelId },
    timeoutMs: options?.timeoutMs,
    next: options?.next,
  });
  const images = response.data?.hotelImages ?? [];
  return [...images].sort((a, b) => {
    if (a.defaultImage !== b.defaultImage) return a.defaultImage ? -1 : 1;
    return (a.order ?? 0) - (b.order ?? 0);
  });
}

/* ---------------------------------------------------------------------------
   POST /hotels/rates — search hotels with live rates for a destination +
   date range + occupancy. Confirmed against the live sandbox (not just the
   docs) on 2026-08-17: a cityName+countryCode search with includeHotelData
   returns two parallel arrays that join 1:1 by id —
     data[]:   { hotelId, roomTypes: [{ offerRetailRate, rates: [...] }] }
     hotels[]: { id, name, main_photo, thumbnail, stars, rating,
                 review_count, address, city_name, country_code,
                 latitude, longitude }
   Every hotel[].id had a matching data[].hotelId and vice versa in that
   sample (28/28) — searchHotels() below still filters defensively in case a
   future search returns a hotel with no priced rooms.
--------------------------------------------------------------------------- */

/**
 * One entry PER ROOM — the array's length is the room count, there is no
 * separate `rooms` parameter (confirmed against the docs and a live call:
 * `[{"adults":2,"children":[11]},{"adults":1}]` means two rooms). `children`
 * is a list of AGES, not a count, and the API requires an age per child.
 */
export type LiteApiOccupancy = {
  adults: number;
  /** Ages in years, one entry per child. Required by the API when a room has
   * children — there is no "2 children, ages unknown" form. */
  children?: number[];
};

export type SearchHotelRatesParams = {
  /** One destination method is required. `placeId` (a Google place ID from
   * /data/places — see searchPlaces) is what this project uses now that the
   * search form has real autocomplete; cityName+countryCode is kept for the
   * older fixed-search path and as a fallback. */
  placeId?: string;
  cityName?: string;
  countryCode?: string;
  hotelIds?: string[];
  latitude?: number;
  longitude?: number;
  radius?: number;
  iataCode?: string;
  checkin: string; // "YYYY-MM-DD"
  checkout: string; // "YYYY-MM-DD"
  occupancies: LiteApiOccupancy[];
  currency?: string;
  guestNationality?: string;
  /** Caps rate options per hotel — this project only needs the cheapest, so
   * the search route always passes 1. */
  maxRatesPerHotel?: number;
  /**
   * How many hotels to CONSIDER, not how many come back. Verified live on
   * 2026-08-17: `limit: 60` returned 17 hotels, `limit: 3` returned 1 — the
   * cap applies to the candidate set, and only hotels with bookable
   * availability for the requested dates/occupancy appear in the response.
   * Defaults to 200 upstream, max 5000. See the pagination note above
   * searchHotelRates() for why this rules out using limit/offset as a
   * user-facing page size.
   */
  limit?: number;
  /** Skips N candidates. Verified live to return a disjoint set from
   * offset 0, but see the limit note — pages are of unpredictable size. */
  offset?: number;
  timeoutMs?: number;
  /** See LiteApiRequestOptions.next — pass e.g. { revalidate: 300 } to keep
   * a fixed test search off the sandbox rate limit during development. */
  next?: NextFetchRequestConfig;
};

export type LiteApiMoneyAmount = { amount: number; currency: string };

export type LiteApiRateOption = {
  rateId: string;
  name: string;
  maxOccupancy: number;
  adultCount: number;
  childCount: number;
  boardType: string;
  boardName: string;
  retailRate: {
    total: LiteApiMoneyAmount[];
    initialPrice: LiteApiMoneyAmount[];
    taxesAndFees?: Array<{
      included: boolean;
      description: string;
      amount: number;
      currency: string;
    }>;
  };
  cancellationPolicies?: {
    refundableTag?: "RFN" | "NRFN" | string;
  };
};

export type LiteApiRoomType = {
  roomTypeId: string;
  offerId: string;
  offerRetailRate: LiteApiMoneyAmount;
  rates: LiteApiRateOption[];
};

export type LiteApiHotelRates = {
  hotelId: string;
  roomTypes: LiteApiRoomType[];
};

export type LiteApiHotelDetails = {
  id: string;
  name: string;
  main_photo?: string;
  thumbnail?: string;
  address?: string;
  city_name?: string;
  country_code?: string;
  latitude?: number;
  longitude?: number;
  rating?: number;
  stars?: number;
  review_count?: number;
};

export type SearchHotelRatesResponse = {
  data: LiteApiHotelRates[];
  hotels: LiteApiHotelDetails[];
  guestLevel: number;
  sandbox: boolean;
};

/**
 * PAGINATION — why the UI does not use limit/offset for its "See more".
 *
 * The endpoint does accept `limit` and `offset`, and they do work (verified
 * live: offset 0 and offset 3 returned disjoint hotels). They are unusable
 * as a page size, though, for two measured reasons:
 *
 *  1. `limit` caps hotels CONSIDERED, not returned. `limit: 60` came back
 *     with 17 hotels; `limit: 3` came back with 1. Only hotels with live
 *     availability survive, so a "next 10" request yields an unpredictable
 *     0-10 cards — including empty pages while more results still exist.
 *  2. There is no total-count field anywhere in the response (checked for
 *     total/totalCount/count/meta/pagination — none present). Paging blind
 *     means never being able to say "X hotels found" honestly, or know when
 *     to hide "See more".
 *
 * So the search route asks for one generous window and returns the whole
 * available set; the page renders 10 at a time from that. See
 * app/api/search/route.ts and app/search/page.tsx.
 */
export function searchHotelRates({
  timeoutMs,
  next,
  ...body
}: SearchHotelRatesParams) {
  return liteApiRequest<SearchHotelRatesResponse>("/hotels/rates", {
    method: "POST",
    body: { ...body, includeHotelData: true },
    timeoutMs,
    next,
  });
}

/* ---------------------------------------------------------------------------
   GET /data/places — destination autocomplete, backed by Google Places.
   Confirmed live on 2026-08-17 against textQuery=Paris:
     { data: [{ placeId, displayName, formattedAddress, types: [...] }],
       fromCache: boolean }

   Two things the response does NOT include, both of which shaped the design:
     - No latitude/longitude. Nothing needs them: /hotels/rates takes the
       placeId directly, and the map fits its bounds to the returned hotels'
       own coordinates.
     - No single clean "kind". `types` is a raw Google type array
       (e.g. ["locality","geocode","political"]), and an unfiltered query is
       noisy — textQuery=Paris returned bakeries and coffee shops alongside
       the city. Hence PLACE_TYPES below.
--------------------------------------------------------------------------- */

/**
 * The `type` filter sent with every autocomplete request. Verified live that
 * this is comma-separated and that filtering to `locality` alone turned a
 * "Paris" query from bakeries-and-cafes into five real cities.
 *
 * EXACTLY FIVE, and that is a hard ceiling, not a preference: the endpoint
 * accepts any of these types individually, but six or more in one request
 * fails with a 500 ("error fetching places from places api"). Found by
 * bisecting a live query — it is not in the docs. Adding a type here means
 * removing one.
 *
 * Deliberately excludes `lodging`/`hotel` even though both are valid types:
 * the docs describe placeId as being for region-based searches, and handing
 * /hotels/rates the place ID of one specific hotel is not a search.
 * Restricting the list to things that are genuinely areas keeps every
 * selectable suggestion a valid search.
 */
const PLACE_TYPES = [
  "locality", // cities
  "neighborhood", // districts within a city
  "administrative_area_level_1", // states / regions
  "airport",
  "tourist_attraction", // landmarks
].join(",");

export type LiteApiPlace = {
  placeId: string;
  displayName: string;
  formattedAddress: string;
  types?: string[];
};

export async function searchPlaces(
  textQuery: string,
  options?: { signal?: AbortSignal; timeoutMs?: number; next?: NextFetchRequestConfig },
): Promise<LiteApiPlace[]> {
  const response = await liteApiRequest<{ data?: LiteApiPlace[] }>(
    "/data/places",
    {
      query: { textQuery, language: "en", type: PLACE_TYPES },
      timeoutMs: options?.timeoutMs,
      next: options?.next,
    },
  );
  return response.data ?? [];
}
