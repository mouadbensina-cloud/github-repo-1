/**
 * Fields marked optional are ones LiteAPI's /hotels/rates response doesn't
 * actually provide at hotel-summary level (confirmed against a live sandbox
 * call, not assumed) — HotelCard/MapHotelCard hide the corresponding UI
 * rather than invent a value for them. See app/api/search/route.ts for the
 * full field-by-field mapping notes.
 */
export type Hotel = {
  id: string;
  name: string;
  stars: number;
  ratingLabel: string;
  reviewCount: string;
  score: string;
  address: string;
  /** Real photo URL when sourced from LiteAPI (hotels[].main_photo); absent
   * for the mock data, which falls back to a flat placeholder shade. */
  image?: string;
  /** "1 mile from centre" — not returned by /hotels/rates; would need a
   * separate distance/POI calculation from lat/lng. */
  distance?: string;
  /** The cheapest rate's own room name (e.g. "1 KING BED W/SOFABED") when
   * sourced from LiteAPI — a real field, but a different concept than the
   * mock data's clean "Single Room" category label. */
  roomType?: string;
  bedInfo?: string;
  breakfastIncluded: boolean;
  freeCancellation: boolean;
  stayInfo: string;
  price: string;
  priceNote: string;
  /** "1 Room · 1 Bed · 1 Bathroom" — the compact summary line the map popup
   * card shows in place of the full HotelCard's room details. Mock-data
   * only; LiteAPI doesn't return room/bed/bathroom counts at this level. */
  roomsSummary?: string;
  /** Map marker position. Real for LiteAPI-sourced hotels (hotels[].latitude
   * /longitude); fake, spread around central London, for the mock data. */
  lat: number;
  lng: number;
};

/**
 * Placeholder results for the search page, lifted from the Figma "Layout on
 * map" frame. Static for now, same as the home page's lib/home-data.ts —
 * swap for the search endpoint later and nothing downstream changes.
 */
export const SEARCH_RESULTS: Hotel[] = [
  {
    id: "club-quarters-st-pauls",
    name: "Club Quarters Hotel, St. Paul's",
    stars: 5,
    ratingLabel: "Excellent",
    reviewCount: "173 reviews",
    score: "10",
    address: "41 White Church Lane, London",
    distance: "1 mile from centre",
    roomType: "Single Room",
    bedInfo: "1 Single bed",
    breakfastIncluded: true,
    freeCancellation: true,
    stayInfo: "1 Night, 3 Adults",
    price: "$340",
    priceNote: "Includes taxes and charges",
    roomsSummary: "1 Room · 1 Bed · 1 Bathroom",
    lat: 51.5138,
    lng: -0.0984,
  },
  {
    id: "villa-marquis-tour-eiffel",
    name: "Villa Marquis member of Meliá Collection Tour Eiffel",
    stars: 5,
    ratingLabel: "Excellent",
    reviewCount: "173 reviews",
    score: "10",
    address: "12 Gower Street, London",
    distance: "0.8 mile from centre",
    roomType: "Single Room",
    bedInfo: "1 Single bed",
    breakfastIncluded: true,
    freeCancellation: true,
    stayInfo: "1 Night, 3 Adults",
    price: "$340",
    priceNote: "Includes taxes and charges",
    roomsSummary: "1 Room · 1 Bed · 1 Bathroom",
    lat: 51.5205,
    lng: -0.1125,
  },
  {
    id: "conrad-london-st-james",
    name: "Conrad London St James",
    stars: 5,
    ratingLabel: "Excellent",
    reviewCount: "173 reviews",
    score: "10",
    address: "22-28 Broadway, London",
    distance: "0.4 mile from centre",
    roomType: "Single Room",
    bedInfo: "1 Single bed",
    breakfastIncluded: true,
    freeCancellation: true,
    stayInfo: "1 Night, 3 Adults",
    price: "$340",
    priceNote: "Includes taxes and charges",
    roomsSummary: "1 Room · 1 Bed · 1 Bathroom",
    lat: 51.4991,
    lng: -0.1329,
  },
  {
    id: "hotel-lorette-astotel",
    name: "Hotel Lorette - Astotel",
    stars: 4,
    ratingLabel: "Excellent",
    reviewCount: "173 reviews",
    score: "9.4",
    address: "281 Heathrow Street, London",
    distance: "1.2 mile from centre",
    roomType: "Double Room",
    bedInfo: "1 Double bed",
    breakfastIncluded: true,
    freeCancellation: false,
    stayInfo: "1 Night, 3 Adults",
    price: "$285",
    priceNote: "Includes taxes and charges",
    roomsSummary: "1 Room · 1 Bed · 1 Bathroom",
    lat: 51.509,
    lng: -0.0754,
  },
  {
    id: "air-rooms-rome-airport",
    name: "Air Rooms Rome Airport by HelloSky",
    stars: 5,
    ratingLabel: "Very good",
    reviewCount: "1073 reviews",
    score: "9.8",
    address: "9 Heathrow Street, London",
    distance: "1.6 mile from centre",
    roomType: "Twin Room",
    bedInfo: "2 Single beds",
    breakfastIncluded: false,
    freeCancellation: true,
    stayInfo: "1 Night, 3 Adults",
    price: "$725",
    priceNote: "Includes taxes and charges",
    roomsSummary: "1 Room · 2 Beds · 1 Bathroom",
    lat: 51.4952,
    lng: -0.153,
  },
];
