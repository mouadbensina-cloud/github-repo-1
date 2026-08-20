import "server-only";
import { headers } from "next/headers";
import { resolveHotelsForPlace } from "./featured-hotels";
import type { Property } from "@/components/property/PropertyCard";

/**
 * The "Nearby hotels" section — 8 real 5-star hotels in the visitor's OWN
 * country, re-rolled on every home-page load. Reuses resolveHotelsForPlace()
 * from lib/featured-hotels.ts (same searchHotelRates call, same
 * guestNationality/currency requirements, same 5-star/photo/review filter)
 * rather than duplicating it — the only new part here is picking WHICH
 * place name to search.
 */

/**
 * Vercel sets this on every request in production, straight from the
 * visitor's IP — no separate geolocation call needed. It is simply absent
 * outside Vercel's network (this project's own local dev server included),
 * so DEFAULT_COUNTRY below is what local development always sees.
 */
const COUNTRY_HEADER = "x-vercel-ip-country";

const DEFAULT_COUNTRY = "US";

/**
 * LiteAPI has no "search by country" — /hotels/rates takes a place
 * (city/region), not a whole country — so this is a hand-curated map from
 * ISO 3166-1 alpha-2 country codes to one representative city to search
 * there, the same kind of deliberate curation FAMOUS_LOCATIONS already is
 * for "famous," just keyed by country instead. Not exhaustive: an unmapped
 * country falls back to DEFAULT_COUNTRY's city, same as an undetectable one.
 */
const COUNTRY_CITIES: Record<string, string> = {
  US: "New York",
  CA: "Toronto",
  MX: "Mexico City",
  BR: "Rio de Janeiro",
  AR: "Buenos Aires",
  GB: "London",
  IE: "Dublin",
  FR: "Paris",
  DE: "Berlin",
  IT: "Rome",
  ES: "Barcelona",
  PT: "Lisbon",
  NL: "Amsterdam",
  BE: "Brussels",
  CH: "Zurich",
  AT: "Vienna",
  SE: "Stockholm",
  NO: "Oslo",
  DK: "Copenhagen",
  FI: "Helsinki",
  PL: "Warsaw",
  CZ: "Prague",
  GR: "Athens",
  TR: "Istanbul",
  RU: "Moscow",
  AE: "Dubai",
  SA: "Riyadh",
  IL: "Tel Aviv",
  EG: "Cairo",
  MA: "Marrakech",
  ZA: "Cape Town",
  NG: "Lagos",
  KE: "Nairobi",
  IN: "Mumbai",
  CN: "Shanghai",
  HK: "Hong Kong",
  TW: "Taipei",
  JP: "Tokyo",
  KR: "Seoul",
  SG: "Singapore",
  TH: "Bangkok",
  VN: "Ho Chi Minh City",
  ID: "Bali",
  PH: "Manila",
  MY: "Kuala Lumpur",
  AU: "Sydney",
  NZ: "Auckland",
  IS: "Reykjavik",
};

async function detectCountryCode(): Promise<string> {
  const requestHeaders = await headers();
  const code = requestHeaders.get(COUNTRY_HEADER)?.trim().toUpperCase();
  return code && COUNTRY_CITIES[code] ? code : DEFAULT_COUNTRY;
}

/**
 * `count` real 5-star hotels from the visitor's detected country. All from
 * ONE city (that country's representative entry in COUNTRY_CITIES) rather
 * than batched across several like getFeaturedHotels — a country only ever
 * resolves to one search here, so there is nothing to fall back to if it
 * comes up short; the section just renders fewer cards, same as any other
 * graceful-degradation case in this codebase.
 */
export async function getNearbyHotels(count = 8): Promise<Property[]> {
  const countryCode = await detectCountryCode();
  const city = COUNTRY_CITIES[countryCode] ?? COUNTRY_CITIES[DEFAULT_COUNTRY];
  return resolveHotelsForPlace(city, count);
}
