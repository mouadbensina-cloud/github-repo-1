/**
 * The search criteria <-> URL query string codec. Every search on the site
 * round-trips through here, so a results URL is fully self-describing: paste
 * it anywhere and it reproduces the same search.
 *
 * Deliberately pure and free of both React and `server-only` — the hero form
 * (client) encodes with it, the results page (client) parses with it, and the
 * API route (server) reuses its occupancy mapping, all from one definition.
 *
 * URL SHAPE
 *   /search?placeId=ChIJD7fiBh9u5kcRYJSMaMOCCwQ
 *          &place=Paris%2C%20France
 *          &placeKind=city
 *          &checkin=2026-10-15
 *          &checkout=2026-10-18
 *          &occupancy=2-5.7_1
 *
 *   placeId    what actually drives the search (LiteAPI /hotels/rates takes
 *              this Google place ID directly — no lat/lng needed, and
 *              /data/places doesn't return any).
 *   place      display name, carried purely so a cold page load can refill
 *              the form's text input without spending an autocomplete call.
 *   placeKind  the icon/label the form shows next to that name, same reason.
 *   occupancy  see encodeOccupancy — per-room, because that is the shape
 *              LiteAPI wants and flat totals cannot round-trip to it.
 *
 * Nothing else belongs in the URL. No personal data, and explicitly no
 * pagination depth: a shared link always opens at the first page of results
 * rather than dropping someone into "showing 30 of 200" from a stranger's
 * session.
 */

/** One room's occupancy. The room COUNT is this array's length. */
export type GuestRoom = {
  adults: number;
  /** Ages in years, one entry per child — LiteAPI requires an age per child,
   * so the UI collects them individually rather than as a count. */
  childAges: number[];
};

/** The friendly categories the autocomplete shows, mapped from Google's raw
 * `types` array server-side (see app/api/places/route.ts) so the UI never
 * has to know about "administrative_area_level_1". */
export type PlaceKind = "city" | "region" | "country" | "airport" | "landmark";

export type SearchPlace = {
  id: string;
  name: string;
  kind: PlaceKind;
};

export type SearchCriteria = {
  place: SearchPlace;
  /** "YYYY-MM-DD" */
  checkin: string;
  /** "YYYY-MM-DD" */
  checkout: string;
  rooms: GuestRoom[];
};

export const MAX_ADULTS_PER_ROOM = 10;
export const MAX_CHILDREN_PER_ROOM = 6;
export const MAX_CHILD_AGE = 17;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const PLACE_KINDS: PlaceKind[] = [
  "city",
  "region",
  "country",
  "airport",
  "landmark",
];

/* -------------------------------------------------------------------------
   Dates. All comparisons are on the "YYYY-MM-DD" strings, which sort
   lexicographically in calendar order — no Date objects, so no timezone
   can shift a date across a day boundary between encoding and parsing.
------------------------------------------------------------------------- */

/** Today in the viewer's own timezone, as "YYYY-MM-DD". */
export function todayISO(date = new Date()): string {
  return toISODate(date);
}

export function toISODate(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Parses "YYYY-MM-DD" to a local midnight Date, or null if it isn't a real
 * calendar date (rejects 2026-02-31, which `new Date()` would roll over). */
export function fromISODate(value: string): Date | null {
  if (!DATE_RE.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

/* -------------------------------------------------------------------------
   Occupancy encoding

   Each room is `<adults>` plus, if it has children, `-` and their ages
   joined by `.`; rooms are joined by `_`. All three separators are
   URL-safe unreserved characters, so the value survives a round trip
   without percent-encoding and stays readable in the address bar.

     2          one room, two adults
     2-5.7      one room, two adults, children aged 5 and 7
     2-5.7_1    the above, plus a second room with one adult
------------------------------------------------------------------------- */

export function encodeOccupancy(rooms: GuestRoom[]): string {
  return rooms
    .map((room) =>
      room.childAges.length
        ? `${room.adults}-${room.childAges.join(".")}`
        : `${room.adults}`,
    )
    .join("_");
}

export function decodeOccupancy(value: string): GuestRoom[] | null {
  if (!value) return null;
  const rooms: GuestRoom[] = [];

  for (const chunk of value.split("_")) {
    const [adultsPart, agesPart] = chunk.split("-");
    const adults = Number(adultsPart);
    if (
      !Number.isInteger(adults) ||
      adults < 1 ||
      adults > MAX_ADULTS_PER_ROOM
    ) {
      return null;
    }

    let childAges: number[] = [];
    if (agesPart !== undefined) {
      if (agesPart === "") return null;
      childAges = agesPart.split(".").map(Number);
      if (
        childAges.length > MAX_CHILDREN_PER_ROOM ||
        childAges.some(
          (age) => !Number.isInteger(age) || age < 0 || age > MAX_CHILD_AGE,
        )
      ) {
        return null;
      }
    }

    rooms.push({ adults, childAges });
  }

  return rooms.length ? rooms : null;
}

/** The exact `occupancies` array LiteAPI's /hotels/rates wants: one object
 * per room, `children` as ages. Omits `children` entirely for adults-only
 * rooms rather than sending an empty array. */
export function toLiteApiOccupancies(rooms: GuestRoom[]) {
  return rooms.map((room) =>
    room.childAges.length
      ? { adults: room.adults, children: room.childAges }
      : { adults: room.adults },
  );
}

/* ------------------------------------------------------------------------- */

export function encodeSearchParams(criteria: SearchCriteria): URLSearchParams {
  return new URLSearchParams({
    placeId: criteria.place.id,
    place: criteria.place.name,
    placeKind: criteria.place.kind,
    checkin: criteria.checkin,
    checkout: criteria.checkout,
    occupancy: encodeOccupancy(criteria.rooms),
  });
}

/**
 * Why the failure cases are named rather than collapsed into null: the
 * results page shows a different message for each, and the whole point of
 * the "don't silently fix it" requirement is that the user is told which
 * part of their link was wrong.
 */
export type ParseFailure =
  | "missing-place"
  | "missing-dates"
  | "invalid-dates"
  | "past-dates"
  | "invalid-occupancy";

export type ParseResult =
  | { ok: true; criteria: SearchCriteria }
  | { ok: false; reason: ParseFailure };

export function parseSearchParams(
  params: URLSearchParams,
  today = todayISO(),
): ParseResult {
  const placeId = params.get("placeId")?.trim();
  if (!placeId) return { ok: false, reason: "missing-place" };

  const checkin = params.get("checkin")?.trim() ?? "";
  const checkout = params.get("checkout")?.trim() ?? "";
  if (!checkin || !checkout) return { ok: false, reason: "missing-dates" };

  if (!fromISODate(checkin) || !fromISODate(checkout)) {
    return { ok: false, reason: "invalid-dates" };
  }
  // Strictly after — a zero-night stay is not a stay.
  if (checkout <= checkin) return { ok: false, reason: "invalid-dates" };
  if (checkin < today) return { ok: false, reason: "past-dates" };

  const rooms = decodeOccupancy(params.get("occupancy")?.trim() ?? "");
  if (!rooms) return { ok: false, reason: "invalid-occupancy" };

  const kindParam = params.get("placeKind") as PlaceKind | null;
  const kind =
    kindParam && PLACE_KINDS.includes(kindParam) ? kindParam : "city";

  return {
    ok: true,
    criteria: {
      place: {
        id: placeId,
        // Falls back to the ID only so the field is never blank; the results
        // header prefers the destination the API echoes back anyway.
        name: params.get("place")?.trim() || placeId,
        kind,
      },
      checkin,
      checkout,
      rooms,
    },
  };
}

/** Human-readable copy for each parse failure, shared by the results page's
 * inline prompt so the wording lives next to the reasons it describes. */
export const PARSE_FAILURE_COPY: Record<
  ParseFailure,
  { title: string; body: string }
> = {
  "missing-place": {
    title: "Tell us where you're going",
    body: "This link doesn't include a destination. Search again to see hotels.",
  },
  "missing-dates": {
    title: "Add your dates",
    body: "This link is missing check-in or check-out dates. Pick them to see availability.",
  },
  "invalid-dates": {
    title: "Those dates don't look right",
    body: "Check-out has to be at least one night after check-in. Choose new dates to continue.",
  },
  "past-dates": {
    title: "This search has expired",
    body: "The check-in date on this link has already passed. Pick new dates to see current availability.",
  },
  "invalid-occupancy": {
    title: "We couldn't read the guest details",
    body: "The rooms and guests on this link aren't valid. Set them again to continue.",
  },
};
