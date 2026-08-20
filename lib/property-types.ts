import "server-only";
import { getHotelTypes } from "./liteapi";
import { getPhotoById, searchFirstPhoto } from "./pexels";
import type { CategoryTile } from "@/components/home/CategoryGrid";

/**
 * The "Stay like a local in any location" cards — a curated slice of
 * LiteAPI's real property types (not the full ~51-entry list; picked
 * deliberately, see PROPERTY_TYPE_ORDER), each illustrated by a Pexels
 * photo. Two independent data sources joined here rather than at either call
 * site, since neither lib/liteapi.ts nor lib/pexels.ts should know the other
 * exists.
 *
 * Both calls are cached hard (a week): a stock-photo category list is about
 * as static as data gets, and re-running these searches on every uncached
 * home-page render would be slow and needlessly burn the API's rate limit
 * for content that never changes hour to hour.
 */
const REVALIDATE_SECONDS = 60 * 60 * 24 * 7;

/**
 * The exact set shown, in the exact order shown — chosen over LiteAPI's full
 * list, which runs to ~51 types including ones too obscure for a homepage
 * ("Affittacamere", "Tree house property") to usefully anchor a search on.
 *
 * Matched case-insensitively against LiteAPI's own `name` field below (so a
 * casing difference doesn't silently drop an entry), but the DISPLAYED title
 * still comes from that same API field, not this literal string — this list
 * only selects and orders, it never overrides wording. That distinction
 * matters here specifically: LiteAPI has both "Country houses" (plural, id
 * 223) and "Country house" (singular, id 252) as separate types, and an
 * exact match is what keeps this list from accidentally pulling in both or
 * silently matching the wrong one.
 */
const PROPERTY_TYPE_ORDER = [
  "Hotels",
  "Hostels",
  "Resorts",
  "Residences",
  "Villas",
  "Guest houses",
  "Motels",
  "Holiday homes",
  "Lodges",
  "Country houses",
];

/**
 * Hand-picked replacements for specific types, keyed by the same lowercased
 * name PROPERTY_TYPE_ORDER matches on — a specific chosen shot rather than
 * whatever searchFirstPhoto(type.name) would have turned up on its own.
 * Fetched by id via getPhotoById, not hardcoded as a CDN URL: Pexels' own
 * image-serving URLs carry query params (crop, size) this app wants to
 * control the same way every other tile's photo already is, and asking the
 * API for the id is what keeps that consistent.
 *
 * Every entry here is a deliberate curation choice, not a fallback for a
 * search that came up empty — searchFirstPhoto already handles that case on
 * its own by leaving the tile's image undefined.
 */
const PHOTO_OVERRIDES: Record<string, number> = {
  // pexels.com/photo/elegant-hotel-corridor-with-stylish-lighting-34496708
  hotels: 34496708,
  // pexels.com/photo/a-room-in-a-hostel-5137980
  hostels: 5137980,
};

export async function getPropertyTypeTiles(): Promise<CategoryTile[]> {
  const allTypes = await getHotelTypes({
    next: { revalidate: REVALIDATE_SECONDS },
  });

  const byName = new Map(
    allTypes.map((type) => [type.name.trim().toLowerCase(), type]),
  );
  const selected = PROPERTY_TYPE_ORDER.map((name) =>
    byName.get(name.trim().toLowerCase()),
  ).filter((type): type is NonNullable<typeof type> => Boolean(type));

  const tiles = await Promise.all(
    selected.map(async (type): Promise<CategoryTile> => {
      const overrideId = PHOTO_OVERRIDES[type.name.trim().toLowerCase()];
      const photo = overrideId
        ? await getPhotoById(overrideId, {
            next: { revalidate: REVALIDATE_SECONDS },
          })
        : await searchFirstPhoto(type.name, {
            next: { revalidate: REVALIDATE_SECONDS },
          });

      return {
        id: String(type.id),
        title: type.name,
        image: photo?.src.landscape,
      };
    }),
  );

  return tiles;
}
