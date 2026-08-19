/**
 * Grey stand-ins for photography that hasn't landed yet.
 *
 * Every card takes an optional `image` prop; when it's missing the card falls
 * back to one of these, picked deterministically from a seed so a given card
 * keeps the same shade across renders instead of flickering between them.
 */
const SHADES = [
  "#c7ccd3",
  "#aeb5be",
  "#9aa2ad",
  "#b8bec6",
  "#8f97a3",
  "#d0d4da",
];

export function placeholderShade(seed: number | string): string {
  const n =
    typeof seed === "number"
      ? seed
      : [...seed].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return SHADES[Math.abs(n) % SHADES.length];
}

/**
 * Background style for a card image slot: the real photo when we have one,
 * otherwise a flat grey block.
 */
export function imageStyle(image: string | undefined, seed: number | string) {
  return image
    ? { backgroundImage: `url(${image})` }
    : { backgroundColor: placeholderShade(seed) };
}
