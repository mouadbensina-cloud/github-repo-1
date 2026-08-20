import "server-only";
import {
  searchHotelRates,
  type LiteApiHotelDetails,
  type LiteApiHotelRates,
} from "./liteapi";
import {
  FAMOUS_LOCATIONS,
  defaultStayParams,
  resolvePlace,
  shuffled,
} from "./explore-locations";
import { hotelHref } from "./hotel-params";
import { toLiteApiOccupancies, type GuestRoom } from "./search-params";
import type { Property } from "@/components/property/PropertyCard";

/**
 * The "Travelers also booked" cards — 8 real 5-star hotels, re-rolled on
 * every home-page load, drawn from the SAME 30-city list "Need ideas?" uses
 * (see FAMOUS_LOCATIONS in lib/explore-locations.ts) so the two sections
 * never contradict each other about what counts as a famous destination.
 */

/** Same reasoning as explore-locations.ts's REVALIDATE_SECONDS: a day-old
 * price for a homepage teaser card is fine, and caching hard here is what
 * keeps this section from burning the sandbox key's 5-req/window rate limit
 * on every single visit — after the first visitor warms a city's cache,
 * everyone else's shuffle just reads it back for free until it expires. */
const REVALIDATE_SECONDS = 60 * 60 * 24;

/** Two adults, one room — this section has no guest details of its own to
 * carry over, same as "Need ideas?"'s fixed occupancy=2. */
const DEFAULT_ROOMS: GuestRoom[] = [{ adults: 2, childAges: [] }];

/** How many 5-star hotels to take from ONE city's search before moving to
 * the next candidate — caps how much of the final 8 can come from a single
 * destination, so the section reads as "around the world" rather than
 * "Paris, mostly". */
const HOTELS_PER_CITY = 2;

function nightsBetween(checkin: string, checkout: string): number {
  const ms = new Date(checkout).getTime() - new Date(checkin).getTime();
  return Math.max(1, Math.round(ms / 86_400_000));
}

/**
 * One hotel, mapped from the same data[]/hotels[] join app/api/search/route
 * uses — trimmed to what a teaser card needs, and returning null for
 * anything that would make a weak card: not actually 5 stars, no photo, or
 * no guest score yet (a "5-star hotel" with zero reviews reads as
 * suspicious, not aspirational).
 */
function mapFeaturedHotel(
  entry: LiteApiHotelRates,
  details: LiteApiHotelDetails | undefined,
  context: { placeId: string; placeName: string; checkin: string; checkout: string; nights: number },
): Property | null {
  if (!details || details.stars !== 5) return null;

  const image = details.main_photo || details.thumbnail;
  const rating = details.rating ?? 0;
  const reviewCount = details.review_count ?? 0;
  if (!image || !rating || !reviewCount) return null;

  let cheapest = entry.roomTypes[0];
  for (const roomType of entry.roomTypes) {
    if (roomType.offerRetailRate.amount < cheapest.offerRetailRate.amount) {
      cheapest = roomType;
    }
  }
  if (!cheapest) return null;

  const { nights } = context;

  return {
    id: details.id,
    name: details.name,
    stars: details.stars,
    address: details.address ?? "",
    price: new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: cheapest.offerRetailRate.currency || "USD",
      maximumFractionDigits: 0,
    }).format(cheapest.offerRetailRate.amount),
    priceUnit: `For ${nights} night${nights === 1 ? "" : "s"}`,
    reviews: `${rating.toFixed(1)} (${reviewCount.toLocaleString()} reviews)`,
    image,
    href: hotelHref(details.id, {
      stay: { checkin: context.checkin, checkout: context.checkout, rooms: DEFAULT_ROOMS },
      place: { id: context.placeId, name: context.placeName, kind: "city" },
    }),
  };
}

/**
 * Up to `limit` real 5-star hotels for one place name — or an empty array on
 * an unresolvable place, a place with no 5-star availability, or any thrown
 * LiteApiError (rate limit/timeout). Same graceful-degradation contract as
 * resolveLocation() in explore-locations.ts: a failed candidate is just
 * skipped in favour of the next one, never allowed to crash the whole
 * section.
 *
 * Not specific to FAMOUS_LOCATIONS — takes any place name, which is what
 * lets lib/nearby-hotels.ts reuse this for a country's representative city
 * instead of duplicating the searchHotelRates/guestNationality/currency
 * plumbing a second time.
 */
export async function resolveHotelsForPlace(
  name: string,
  limit: number,
): Promise<Property[]> {
  const place = await resolvePlace(name);
  if (!place) return [];

  try {
    const { checkin, checkout } = defaultStayParams();
    const result = await searchHotelRates({
      placeId: place.placeId,
      checkin,
      checkout,
      occupancies: toLiteApiOccupancies(DEFAULT_ROOMS),
      // Both required by /hotels/rates (verified live: a request missing
      // either 400s naming the field) — same fallback defaults
      // app/api/search/route.ts uses when a search doesn't supply its own,
      // which is always true here since this section has no user-facing
      // nationality/currency input.
      guestNationality: "US",
      currency: "USD",
      maxRatesPerHotel: 1,
      limit: 100,
      timeoutMs: 10000,
      next: { revalidate: REVALIDATE_SECONDS },
    });

    const detailsById = new Map(result.hotels.map((h) => [h.id, h]));
    const nights = nightsBetween(checkin, checkout);
    const context = {
      placeId: place.placeId,
      placeName: place.displayName,
      checkin,
      checkout,
      nights,
    };

    const fiveStar = result.data
      .map((entry) => mapFeaturedHotel(entry, detailsById.get(entry.hotelId), context))
      .filter((hotel): hotel is Property => hotel !== null);

    return shuffled(fiveStar).slice(0, limit);
  } catch {
    return [];
  }
}

/**
 * `count` random, successfully-resolved 5-star hotels — re-rolled on every
 * call, batched across candidate cities the same way getExploreTiles is:
 * the common case (the first few shuffled cities between them have enough
 * 5-star hotels) pays for only as many parallel city searches as needed to
 * reach `count`, and a cold cache or a rate-limited city just costs another
 * round rather than failing the section outright.
 */
export async function getFeaturedHotels(count = 8): Promise<Property[]> {
  const candidates = shuffled(FAMOUS_LOCATIONS);
  const hotels: Property[] = [];
  let offset = 0;

  while (hotels.length < count && offset < candidates.length) {
    const citiesNeeded = Math.ceil((count - hotels.length) / HOTELS_PER_CITY);
    const batch = candidates.slice(offset, offset + citiesNeeded);
    offset += batch.length;

    const resolved = await Promise.all(
      batch.map((name) => resolveHotelsForPlace(name, HOTELS_PER_CITY)),
    );
    for (const cityHotels of resolved) {
      for (const hotel of cityHotels) {
        if (hotels.length >= count) break;
        hotels.push(hotel);
      }
    }
  }

  return hotels.slice(0, count);
}
