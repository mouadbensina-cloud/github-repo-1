import { NextResponse, type NextRequest } from "next/server";
import { searchPlaces, LiteApiError } from "@/lib/liteapi";
import type { PlaceKind } from "@/lib/search-params";

/**
 * GET /api/places?q=par — destination autocomplete for the hero search form.
 *
 * Exists as a proxy rather than the form calling LiteAPI directly because
 * LITEAPI_KEY must never reach the browser (lib/liteapi.ts is server-only and
 * would fail the build if imported client-side).
 *
 * Two guards here rather than in the component, so they hold no matter who
 * calls this route:
 *   - queries under MIN_QUERY_LENGTH short-circuit to an empty list without
 *     touching LiteAPI, since /data/places bills $0.01 per request
 *   - results are capped at MAX_RESULTS
 */

const MIN_QUERY_LENGTH = 2;
const MAX_RESULTS = 5;

/**
 * Google's `types` array is ordered by relevance but mixes categories freely
 * (a city comes back as ["locality","geocode","political"]), so this picks
 * the first entry that maps to something a traveller would recognise rather
 * than trusting types[0]. Order matters: an airport is also a
 * "point_of_interest", and we want "Airport".
 */
const KIND_BY_TYPE: [type: string, kind: PlaceKind][] = [
  ["airport", "airport"],
  ["international_airport", "airport"],
  ["country", "country"],
  ["administrative_area_level_1", "region"],
  ["administrative_area_level_2", "region"],
  ["locality", "city"],
  ["postal_town", "city"],
  ["sublocality", "city"],
  ["neighborhood", "city"],
  ["tourist_attraction", "landmark"],
  ["point_of_interest", "landmark"],
];

function kindOf(types: string[] | undefined): PlaceKind {
  if (types?.length) {
    for (const [type, kind] of KIND_BY_TYPE) {
      if (types.includes(type)) return kind;
    }
  }
  return "city";
}

export type PlaceSuggestion = {
  id: string;
  name: string;
  /** "France", "TX, USA" — Google's formattedAddress, shown as the subtitle
   * that disambiguates the five Parises from each other. */
  detail: string;
  kind: PlaceKind;
};

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";

  if (query.length < MIN_QUERY_LENGTH) {
    return NextResponse.json({ places: [] });
  }

  try {
    const places = await searchPlaces(query, {
      // Autocomplete is in front of a typing user, so it gets a tighter
      // budget than a rates search: better to fail fast and let the next
      // keystroke try again than to leave a spinner hanging.
      timeoutMs: 3000,
      // Place results for a given prefix are effectively static, and every
      // miss costs $0.01 — cache hard. Next keys this by the full request
      // URL, so each distinct query gets its own entry.
      next: { revalidate: 86_400 },
    });

    const suggestions: PlaceSuggestion[] = places
      .slice(0, MAX_RESULTS)
      .map((place) => ({
        id: place.placeId,
        name: place.displayName,
        detail: place.formattedAddress,
        kind: kindOf(place.types),
      }));

    return NextResponse.json({ places: suggestions });
  } catch (error) {
    if (error instanceof LiteApiError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status ?? 502 },
      );
    }
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
