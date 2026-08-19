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
  | "plus";

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
