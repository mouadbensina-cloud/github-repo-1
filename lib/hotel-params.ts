/**
 * The hotel-details page's URL codec.
 *
 * Deliberately NOT parseSearchParams: that codec treats a missing destination
 * or missing dates as a failure, because a search without them is not a
 * search. A hotel page is different — the hotel id is in the PATH, so
 * /hotel/lp1deeb with no query at all is a perfectly valid, shareable link to
 * a real hotel. It just can't be priced yet.
 *
 * So this parser has three outcomes rather than two, and "no dates" is a
 * first-class one ("incomplete"), not an error:
 *
 *   complete    -> fire the rates call, render room cards
 *   incomplete  -> render all the hotel metadata, prompt for dates in the
 *                  rooms section, fire NO rates call
 *   invalid     -> someone hand-edited the link into nonsense; say which part
 *
 * URL SHAPE
 *   /hotel/lp1deeb?checkin=2026-09-16
 *                 &checkout=2026-09-18
 *                 &occupancy=2
 *                 &placeId=ChIJ...      (optional, see below)
 *                 &place=Paris
 *                 &placeKind=city
 *
 * The place trio is carried purely so the header search bar and the booking
 * widget's "Where" field can refill themselves on a cold load without
 * spending an autocomplete call — the hotel is identified by the path id, so
 * nothing about the page's own data depends on it. When it is absent (a bare
 * link), the widget falls back to the hotel's own city from the API.
 */

import {
  decodeOccupancy,
  encodeOccupancy,
  fromISODate,
  todayISO,
  type GuestRoom,
  type PlaceKind,
  type SearchPlace,
} from "./search-params";

/** Dates + guests, with no destination — the hotel is already chosen. */
export type StayCriteria = {
  /** "YYYY-MM-DD" */
  checkin: string;
  /** "YYYY-MM-DD" */
  checkout: string;
  rooms: GuestRoom[];
};

export type StayParseFailure =
  | "invalid-dates"
  | "past-dates"
  | "invalid-occupancy";

export type StayParseResult =
  /** Everything needed to price a stay. */
  | { ok: true; stay: StayCriteria }
  /** A valid hotel link that simply hasn't been given dates yet. */
  | { ok: false; reason: "incomplete" }
  | { ok: false; reason: StayParseFailure };

const PLACE_KINDS: PlaceKind[] = [
  "city",
  "region",
  "country",
  "airport",
  "landmark",
];

/**
 * Partial by design: `place` is optional, and `stay` is optional, so this
 * builds both a fully-priced link (from a search result) and a bare one.
 */
export function encodeHotelParams(options: {
  stay?: StayCriteria;
  place?: SearchPlace;
}): URLSearchParams {
  const params = new URLSearchParams();

  if (options.stay) {
    params.set("checkin", options.stay.checkin);
    params.set("checkout", options.stay.checkout);
    params.set("occupancy", encodeOccupancy(options.stay.rooms));
  }

  if (options.place) {
    params.set("placeId", options.place.id);
    params.set("place", options.place.name);
    params.set("placeKind", options.place.kind);
  }

  return params;
}

/** `/hotel/:id?...` — the one place this path is spelled out, so the results
 * card, the map popup and any future entry point can't drift apart. */
export function hotelHref(
  hotelId: string,
  options: { stay?: StayCriteria; place?: SearchPlace } = {},
): string {
  const query = encodeHotelParams(options).toString();
  return query
    ? `/hotel/${encodeURIComponent(hotelId)}?${query}`
    : `/hotel/${encodeURIComponent(hotelId)}`;
}

/**
 * Validates only what is PRESENT. An empty query is "incomplete", never
 * invalid — see the module comment. Anything half-supplied (a check-in with
 * no check-out, a check-out before check-in, a garbled occupancy) IS an
 * error, because it means the link was mangled rather than never priced.
 */
export function parseStayParams(
  params: URLSearchParams,
  today = todayISO(),
): StayParseResult {
  const checkin = params.get("checkin")?.trim() ?? "";
  const checkout = params.get("checkout")?.trim() ?? "";
  const occupancy = params.get("occupancy")?.trim() ?? "";

  // Nothing supplied at all — a bare, still-valid hotel link.
  if (!checkin && !checkout && !occupancy) return { ok: false, reason: "incomplete" };

  // Partially supplied. Treated as incomplete rather than invalid: the page
  // can still recover simply by asking for the missing half, and the user
  // gets the date picker instead of a scolding.
  if (!checkin || !checkout) return { ok: false, reason: "incomplete" };

  if (!fromISODate(checkin) || !fromISODate(checkout)) {
    return { ok: false, reason: "invalid-dates" };
  }
  // Strictly after — a zero-night stay is not a stay.
  if (checkout <= checkin) return { ok: false, reason: "invalid-dates" };
  if (checkin < today) return { ok: false, reason: "past-dates" };

  // Dates are good but guests are missing. Rather than reject an otherwise
  // complete link over a param most people would never notice was absent,
  // fall back to the SAME default the search form starts from (two adults,
  // one room) so a hotel link and a search link price identically.
  if (!occupancy) {
    return {
      ok: true,
      stay: { checkin, checkout, rooms: [{ adults: 2, childAges: [] }] },
    };
  }

  const rooms = decodeOccupancy(occupancy);
  if (!rooms) return { ok: false, reason: "invalid-occupancy" };

  return { ok: true, stay: { checkin, checkout, rooms } };
}

/** The optional display-only place, when the link carried one. */
export function parsePlaceParams(params: URLSearchParams): SearchPlace | undefined {
  const id = params.get("placeId")?.trim();
  const name = params.get("place")?.trim();
  if (!id || !name) return undefined;

  const kindParam = params.get("placeKind") as PlaceKind | null;
  return {
    id,
    name,
    kind: kindParam && PLACE_KINDS.includes(kindParam) ? kindParam : "city",
  };
}

export const STAY_FAILURE_COPY: Record<
  StayParseFailure,
  { title: string; body: string }
> = {
  "invalid-dates": {
    title: "Those dates don't look right",
    body: "Check-out has to be at least one night after check-in. Pick new dates to see rooms.",
  },
  "past-dates": {
    title: "These dates have passed",
    body: "The check-in date on this link is in the past. Pick new dates to see what's available.",
  },
  "invalid-occupancy": {
    title: "We couldn't read the guest details",
    body: "The rooms and guests on this link aren't valid. Set them again to see rooms.",
  },
};
