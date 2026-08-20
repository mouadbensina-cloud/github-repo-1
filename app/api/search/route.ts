import { NextResponse, type NextRequest } from "next/server";
import {
  searchHotelRates,
  LiteApiError,
  type LiteApiHotelRates,
  type LiteApiHotelDetails,
} from "@/lib/liteapi";
import {
  parseSearchParams,
  toLiteApiOccupancies,
  type GuestRoom,
} from "@/lib/search-params";
import type { Hotel } from "@/lib/search-data";

/**
 * GET /api/search — proxies LiteAPI's POST /hotels/rates and reshapes its
 * two parallel arrays (data[] for rates, hotels[] for name/photo/stars) into
 * the flat Hotel[] shape HotelCard/MapHotelCard already render. See the
 * field-by-field notes on mapHotel() below for exactly what's real LiteAPI
 * data vs. derived vs. simply unavailable at this level.
 *
 * Takes the same query params the results URL carries, parsed and validated
 * by the one shared codec in lib/search-params.ts, so a malformed link fails
 * here the same way it fails in the page rather than reaching LiteAPI.
 *
 * Returns the FULL available result set in one response, not a page of it —
 * see the pagination note above searchHotelRates() in lib/liteapi.ts for the
 * measured reasons limit/offset can't back a "See more". `total` is
 * therefore a real total, and the page slices it 10 at a time.
 */

/**
 * One window wide enough that the whole result set nearly always fits, so
 * "See more" never needs another round trip. `limit` caps hotels CONSIDERED
 * rather than returned (verified: 60 considered -> 17 with availability), so
 * this is deliberately several times the number of cards anyone will page
 * through, not a page size.
 */
const CANDIDATE_LIMIT = 200;

const RATING_LABEL_THRESHOLDS: [min: number, label: string][] = [
  [9, "Exceptional"],
  [8, "Excellent"],
  [7, "Very good"],
  [6, "Good"],
  [0, "Pleasant"],
];

function ratingLabelFor(rating: number): string {
  for (const [min, label] of RATING_LABEL_THRESHOLDS) {
    if (rating >= min) return label;
  }
  return "Pleasant";
}

function nightsBetween(checkin: string, checkout: string): number {
  const ms = new Date(checkout).getTime() - new Date(checkin).getTime();
  return Math.max(1, Math.round(ms / 86_400_000));
}

function priceToNumber(price: string): number {
  return Number(price.replace(/[^0-9.]/g, "")) || 0;
}

/**
 * data[] (rates) and hotels[] (name/photo/stars/address/lat-lng) join 1:1 by
 * id — confirmed against a live sandbox call, not assumed from docs. Returns
 * null for a hotel with no priced rooms or no matching details entry, which
 * the caller filters out.
 *
 * Field-by-field, what's real vs derived vs missing (see also the Hotel type
 * doc comments in lib/search-data.ts):
 *   id, name, stars, address, lat/lng   — direct from hotels[]
 *   image                               — hotels[].main_photo, falls back to
 *                                          .thumbnail
 *   score                               — hotels[].rating (0-10), formatted
 *   ratingLabel                         — DERIVED from that rating via fixed
 *                                          thresholds (LiteAPI gives a
 *                                          number, never a text label)
 *   reviewCount                         — hotels[].review_count, formatted
 *   price                               — cheapest roomTypes[].offerRetailRate
 *   priceNote                           — DERIVED: checks whether every
 *                                          retailRate.taxesAndFees entry is
 *                                          `included`; if any aren't (e.g. a
 *                                          resort fee due at the property),
 *                                          says so instead of unconditionally
 *                                          claiming "includes taxes and
 *                                          charges" the way the mock data did
 *   breakfastIncluded                   — DERIVED: the cheapest rate's
 *                                          boardName contains "breakfast"
 *   freeCancellation                    — DERIVED: cheapest rate's
 *                                          cancellationPolicies.refundableTag
 *                                          === "RFN"
 *   roomType                            — the cheapest rate's own `name`
 *                                          (e.g. "1 KING BED W/SOFABED") —
 *                                          real, but a room-specific string,
 *                                          not the mock's clean category
 *                                          label; also doubles as bed info,
 *                                          so bedInfo is left unset
 *   stayInfo                            — computed from OUR OWN request's
 *                                          checkin/checkout/adults, not from
 *                                          the response
 *   distance, bedInfo, roomsSummary     — NOT returned by this endpoint at
 *                                          any level; left undefined so the
 *                                          cards hide those rows rather than
 *                                          show a fabricated value
 */
function mapHotel(
  entry: LiteApiHotelRates,
  details: LiteApiHotelDetails | undefined,
  context: { nights: number; stayInfo: string; fallbackCurrency: string },
): Hotel | null {
  if (!details) return null;

  let cheapest = entry.roomTypes[0];
  for (const roomType of entry.roomTypes) {
    if (roomType.offerRetailRate.amount < cheapest.offerRetailRate.amount) {
      cheapest = roomType;
    }
  }
  if (!cheapest) return null;

  const rate = cheapest.rates[0];
  const amount = cheapest.offerRetailRate.amount;
  const currency = cheapest.offerRetailRate.currency || context.fallbackCurrency;
  const rating = details.rating ?? 0;

  const taxesAndFees = rate?.retailRate.taxesAndFees ?? [];
  const hasExcludedFees = taxesAndFees.some((fee) => !fee.included);

  return {
    id: details.id,
    name: details.name,
    image: details.main_photo || details.thumbnail,
    stars: details.stars ?? 0,
    ratingLabel: ratingLabelFor(rating),
    reviewCount: `${details.review_count ?? 0} reviews`,
    score: rating ? rating.toFixed(1) : "—",
    address: details.address ?? "",
    roomType: rate?.name,
    breakfastIncluded: /breakfast/i.test(rate?.boardName ?? ""),
    freeCancellation: rate?.cancellationPolicies?.refundableTag === "RFN",
    stayInfo: context.stayInfo,
    price: new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount),
    priceNote: hasExcludedFees
      ? "Excludes fees due at property"
      : "Includes taxes and fees",
    lat: details.latitude ?? 0,
    lng: details.longitude ?? 0,
  };
}

/** "3 Nights, 2 Adults, 1 Child · 2 Rooms" — built from OUR request, since
 * the response carries nothing about what was asked for. */
function stayInfoFor(rooms: GuestRoom[], nights: number): string {
  const adults = rooms.reduce((sum, room) => sum + room.adults, 0);
  const children = rooms.reduce((sum, room) => sum + room.childAges.length, 0);

  const parts = [`${nights} Night${nights === 1 ? "" : "s"}`];
  parts.push(`${adults} Adult${adults === 1 ? "" : "s"}`);
  if (children) parts.push(`${children} Child${children === 1 ? "" : "ren"}`);

  const roomsLabel = `${rooms.length} Room${rooms.length === 1 ? "" : "s"}`;
  return `${parts.join(", ")} · ${roomsLabel}`;
}

export async function GET(request: NextRequest) {
  const parsed = parseSearchParams(request.nextUrl.searchParams);
  if (!parsed.ok) {
    // The page validates the same URL with the same codec before ever
    // calling here, so this is a direct/hand-edited request — 400 with the
    // machine-readable reason rather than a guessed-at default search.
    return NextResponse.json(
      { error: "Invalid search criteria", reason: parsed.reason },
      { status: 400 },
    );
  }

  const { place, checkin, checkout, rooms } = parsed.criteria;
  const currency = request.nextUrl.searchParams.get("currency") ?? "USD";
  const guestNationality =
    request.nextUrl.searchParams.get("guestNationality") ?? "US";

  try {
    const result = await searchHotelRates({
      placeId: place.id,
      checkin,
      checkout,
      occupancies: toLiteApiOccupancies(rooms),
      currency,
      guestNationality,
      maxRatesPerHotel: 1,
      limit: CANDIDATE_LIMIT,
      // liteApiRequest's own default (4000ms) is tuned for a single-hotel
      // call — this one prices up to CANDIDATE_LIMIT (200) hotels in one
      // request and was measurably slower, timing out under real load even
      // though the upstream call was still progressing. 10000 is the
      // client's own ceiling (see MAX_TIMEOUT_MS in lib/liteapi.ts); every
      // other call in this codebase that fans out this wide (getHotelDetail,
      // getHotelReviews) already overrides the default the same way.
      timeoutMs: 10000,
      // The sandbox key is rate-limited (5 req/window as of this writing) and
      // a rates call is slow, so identical searches — a shared link opened
      // twice, a dev-mode effect double-invoke, a back-navigation — reuse one
      // upstream call. Keyed by the full request URL, so changing any
      // criterion still searches fresh.
      next: { revalidate: 300 },
    });

    const detailsById = new Map(result.hotels.map((h) => [h.id, h]));
    const nights = nightsBetween(checkin, checkout);
    const stayInfo = stayInfoFor(rooms, nights);

    const hotels = result.data
      .map((entry) =>
        mapHotel(entry, detailsById.get(entry.hotelId), {
          nights,
          stayInfo,
          fallbackCurrency: currency,
        }),
      )
      .filter((hotel): hotel is Hotel => hotel !== null)
      .sort((a, b) => priceToNumber(a.price) - priceToNumber(b.price));

    return NextResponse.json({
      hotels,
      // The real total for "X hotels found" — this response is the complete
      // available set, not a page of it.
      total: hotels.length,
      destination: place.name,
    });
  } catch (error) {
    if (error instanceof LiteApiError) {
      // A place ID that LiteAPI won't accept comes back as a 400 whose body
      // names the field (verified live: {"error":{"code":4000,"description":
      // "invalid placeId"}}). Flagged as its own reason so the page can say
      // "we couldn't find this location" instead of rendering an empty grid
      // that reads as "this city has no hotels".
      if (error.status === 400 && /placeid/i.test(error.message)) {
        return NextResponse.json(
          { error: "Unknown location", reason: "unresolved-place" },
          { status: 404 },
        );
      }
      return NextResponse.json(
        { error: error.message },
        { status: error.status ?? 502 },
      );
    }
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
