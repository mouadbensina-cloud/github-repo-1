import type { Property } from "@/components/property/PropertyCard";
import type { CategoryTile } from "@/components/home/CategoryGrid";

/**
 * Placeholder content lifted from the Figma home page. Everything here is
 * static so the sections can be built and reviewed before the search/content
 * APIs exist — swap each export for a fetch and nothing downstream changes.
 */

export const TRAVELERS_ALSO_BOOKED: Property[] = [
  {
    id: "air-rooms-rome",
    name: "Air Rooms Rome Airport by HelloSky HelloSky",
    stars: 5,
    address: "281 Street, Heathrow, London",
    distance: "971 m from center",
    price: "$725",
    priceUnit: "For 2 nights",
    reviews: "9.8 (1073 reviews)",
    badge: "Price dropped",
  },
  {
    id: "hotel-lorette",
    name: "Hotel Lorette - Astotel",
    stars: 4,
    address: "281 Street, Heathrow, London",
    distance: "971 m from center",
    price: "$828",
    priceUnit: "For 2 nights",
    reviews: "9.8 (1073 reviews)",
  },
  {
    id: "hotel-lorette-2",
    name: "Hotel Lorette - Astotel",
    stars: 4,
    address: "281 Street, Heathrow, London",
    distance: "971 m from center",
    price: "$828",
    priceUnit: "For 2 nights",
    reviews: "9.8 (1073 reviews)",
  },
  {
    id: "conrad-london",
    name: "Conrad London St James",
    stars: 4,
    address: "Conrad London St James",
    distance: "971 m from center",
    price: "$821",
    priceUnit: "For 2 nights",
    reviews: "9.8 (1073 reviews)",
  },
];

export const NEARBY_HOTELS: Property[] = TRAVELERS_ALSO_BOOKED.map((p) => ({
  ...p,
  id: `nearby-${p.id}`,
}));

export const STAY_LIKE_A_LOCAL: CategoryTile[] = [
  { id: "private-vacation-homes", title: "Private vacation homes" },
  { id: "apartments", title: "Apartments" },
  { id: "boutique-hotels", title: "Boutique hotels" },
  { id: "villas", title: "Villas" },
];

export const NEED_IDEAS: CategoryTile[] = [
  { id: "mallorca", title: "Mallorca", subtitle: "5,760 properties" },
  { id: "lisbon", title: "Lisbon", subtitle: "3,412 properties" },
  { id: "santorini", title: "Santorini", subtitle: "1,908 properties" },
  { id: "amalfi", title: "Amalfi Coast", subtitle: "2,236 properties" },
];
