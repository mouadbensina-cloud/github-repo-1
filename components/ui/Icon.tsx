import type { CSSProperties } from "react";

export type IconName =
  | "stays"
  | "flight"
  | "experience"
  | "mic"
  | "search"
  | "globe"
  | "chevron"
  | "chevron-down"
  | "star"
  | "dot"
  | "pin"
  | "walking"
  | "heart"
  | "sparkle"
  | "close"
  | "arrow-right"
  | "filters"
  | "sort"
  | "checkmark"
  | "coffee"
  | "list"
  | "map"
  | "clock"
  | "building"
  | "minus"
  | "plus"
  // Hotel facilities (see FACILITY_CATALOG in lib/hotel-data.ts, which is what
  // decides which of these a given hotel actually shows).
  | "wifi"
  | "car"
  | "pool"
  | "paw"
  | "utensils"
  | "wine"
  | "dumbbell"
  | "spa"
  | "snowflake"
  | "ac"
  | "users"
  | "tree"
  | "hanger"
  | "elevator"
  | "bus"
  | "accessible"
  | "luggage"
  | "ban"
  | "bell"
  | "tv"
  | "lock"
  // Room offer cards + review-category scores.
  | "square-scale"
  | "shield-check"
  | "shield-ban"
  | "sparkles"
  | "smile"
  | "component"
  | "tag"
  | "bed-double"
  | "images"
  // Room-level amenities (see ROOM_AMENITY_ICONS in lib/hotel-data.ts) —
  // distinct from the hotel-wide facility set above.
  | "shower"
  | "phone"
  | "wind"
  | "flame"
  | "fridge"
  | "sofa";

/**
 * Renders an exported Figma icon as a CSS mask filled with `currentColor`, so a
 * single asset can be tinted per state without shipping a variant per colour.
 */
export function Icon({
  name,
  size = 18,
  className = "",
  style,
}: {
  name: IconName;
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      aria-hidden
      className={`icon-mask shrink-0 ${className}`}
      style={
        {
          "--icon": `url(/icons/${name}.svg)`,
          width: size,
          height: size,
          ...style,
        } as CSSProperties
      }
    />
  );
}
