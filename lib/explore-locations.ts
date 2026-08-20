import "server-only";
import { getHotelCountForPlace, searchPlaces, type LiteApiPlace } from "./liteapi";
import { searchFirstPhoto } from "./pexels";
import { toISODate } from "./search-params";
import type { CategoryTile } from "@/components/home/CategoryGrid";

/**
 * The "Need ideas?" cards — 4 random picks from a curated 30-city list,
 * re-rolled on every home-page load (see getExploreTiles), each backed by a
 * REAL place (resolved through the same /data/places lookup the header
 * search bar's autocomplete uses), a REAL property count (LiteAPI's own
 * hotel listing for that place, not a guessed number), a Pexels photo, and a
 * working link straight into that place's search results.
 */

/**
 * Deliberately a plain name list, not place objects: "most famous places in
 * the world" is a curation call only a human can make, so this is exactly
 * that — hardcoded on purpose — while everything else about each card
 * (its real placeId, its real property count, its photo) is looked up live
 * rather than also hardcoded, so none of it can go stale the way a
 * hand-typed placeId or property count would.
 */
export const FAMOUS_LOCATIONS = [
  "Paris",
  "London",
  "New York",
  "Tokyo",
  "Rome",
  "Barcelona",
  "Dubai",
  "Singapore",
  "Bangkok",
  "Istanbul",
  "Amsterdam",
  "Prague",
  "Venice",
  "Santorini",
  "Marrakech",
  "Cape Town",
  "Sydney",
  "Rio de Janeiro",
  "Los Angeles",
  "San Francisco",
  "Hong Kong",
  "Seoul",
  "Kyoto",
  "Vienna",
  "Berlin",
  "Madrid",
  "Lisbon",
  "Cairo",
  "Reykjavik",
  "Bali",
];

/** How long a resolved location's placeId/count/photo stay cached. Even
 * though WHICH 4 cities show is re-rolled every visit, the data behind any
 * one city barely changes — a property count a day stale is not worth
 * re-fetching for. */
const REVALIDATE_SECONDS = 60 * 60 * 24;

/** A fixed, generous-but-not-huge default stay so a homepage teaser card has
 * somewhere concrete to link to — 2 weeks out, 2 nights, 2 adults. Shared by
 * "Need ideas?" (search links) and lib/featured-hotels.ts (rates search +
 * hotel links): neither page has dates of its own to carry over, and
 * whatever they land on lets the visitor change all of it immediately via
 * the same booking-widget pattern every other page already uses. */
export function defaultStayParams(): { checkin: string; checkout: string } {
  const checkin = new Date();
  checkin.setDate(checkin.getDate() + 14);
  const checkout = new Date();
  checkout.setDate(checkout.getDate() + 16);
  return { checkin: toISODate(checkin), checkout: toISODate(checkout) };
}

/**
 * The FIRST result isn't always the right one: searching "Hong Kong"
 * returned "Hong Kong International Airport" ahead of the city itself (both
 * genuinely match the text; the airport just isn't a "famous destination"
 * card in the sense this list means). So this skips past anything typed as
 * an airport/landmark rather than a real place.
 *
 * It does NOT then prefer "locality" over "administrative_area_level_1" —
 * an earlier version did, which broke "Bali": Google's top (and correct)
 * match for that query is the Indonesian island/province itself, typed
 * "administrative_area_level_1", but a lower-ranked, worse text match —
 * "Balıkesir", a Turkish city typed "locality" — was outranking it under
 * that rule. Trusting the API's own relevance order and only filtering OUT
 * non-place types (rather than also reordering by type) is what keeps both
 * cases right: the airport still gets skipped, and Bali still wins.
 */
function pickCityPlace(places: LiteApiPlace[]): LiteApiPlace | undefined {
  return (
    places.find(
      (place) =>
        place.types?.includes("locality") ||
        place.types?.includes("administrative_area_level_1"),
    ) ?? places[0]
  );
}

/**
 * The searchPlaces + pickCityPlace step alone, wrapped to never throw — or
 * null if the name didn't resolve to anything at all. Shared by
 * getExploreTiles (below) and lib/featured-hotels.ts, which both start from
 * the same FAMOUS_LOCATIONS names and need the same "real place, not an
 * airport/wrong-city" resolution; keeping it here means the Hong Kong/Bali
 * fix in pickCityPlace only has to exist once.
 *
 * The try/catch matters as much as the null case: the LiteAPI sandbox key is
 * rate-limited (5 req/window, same constraint documented on
 * searchHotelRates), and unlike lib/pexels.ts — which was built to swallow
 * its own failures — searchPlaces surfaces a real LiteApiError on a rate
 * limit or timeout. Without this, one unlucky candidate hitting that limit
 * would throw out of whichever Promise.all is resolving a batch of
 * candidates and take the entire home page down with it, rather than simply
 * being skipped in favour of the next shuffled candidate the way an empty
 * result already is.
 */
export async function resolvePlace(name: string): Promise<LiteApiPlace | null> {
  try {
    const places = await searchPlaces(name, {
      timeoutMs: 5000,
      next: { revalidate: REVALIDATE_SECONDS },
    });
    return pickCityPlace(places) ?? null;
  } catch {
    return null;
  }
}

/**
 * One location, fully resolved — or null if resolvePlace came back empty, or
 * the count/photo lookups came back empty or threw (same rate-limit
 * reasoning as resolvePlace itself).
 */
async function resolveLocation(name: string): Promise<CategoryTile | null> {
  const place = await resolvePlace(name);
  if (!place) return null;

  try {
    const [count, photo] = await Promise.all([
      getHotelCountForPlace(place.placeId, {
        next: { revalidate: REVALIDATE_SECONDS },
      }),
      searchFirstPhoto(name, { next: { revalidate: REVALIDATE_SECONDS } }),
    ]);
    if (!count || !photo) return null;

    return buildTile(place, count, photo);
  } catch {
    return null;
  }
}

function buildTile(
  place: LiteApiPlace,
  count: number,
  photo: { src: { landscape: string } },
): CategoryTile {
  const { checkin, checkout } = defaultStayParams();
  const href =
    `/search?placeId=${encodeURIComponent(place.placeId)}` +
    `&place=${encodeURIComponent(place.displayName)}` +
    `&placeKind=city` +
    `&checkin=${checkin}&checkout=${checkout}` +
    // Same encoding lib/search-params.ts's encodeOccupancy uses for "2
    // adults, 1 room" — inlined rather than imported so this stays a plain
    // string builder with no dependency on that codec's internal format.
    `&occupancy=2`;

  return {
    id: place.placeId,
    title: place.displayName,
    subtitle: `${count.toLocaleString()} properties`,
    image: photo.src.landscape,
    href,
  };
}

export function shuffled<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * `count` random, successfully-resolved cities — re-rolled on every call
 * (no caching at this level, only the per-city lookups inside
 * resolveLocation are cached), which is what makes every home-page load
 * show a different 4 of the 30.
 *
 * Resolved in BATCHES of `count`, each batch run in parallel, rather than
 * either firing all 30 at once or walking the list one at a time — the
 * common case (all 4 candidates in the first batch resolve fine) pays for
 * exactly 4 parallel round trips, same latency as a single lookup; only a
 * genuine failure (an unresolvable name, a place with no listed hotels)
 * costs a second batch, and even a fully cold cache never pays for more
 * than it needs to reach `count`.
 */
export async function getExploreTiles(count = 4): Promise<CategoryTile[]> {
  const candidates = shuffled(FAMOUS_LOCATIONS);
  const tiles: CategoryTile[] = [];
  let offset = 0;

  while (tiles.length < count && offset < candidates.length) {
    const remaining = count - tiles.length;
    const batch = candidates.slice(offset, offset + remaining);
    offset += batch.length;

    const resolved = await Promise.all(batch.map(resolveLocation));
    for (const tile of resolved) if (tile) tiles.push(tile);
  }

  return tiles;
}
