import { fitIcon } from "morphicons";

// Same path data as public/icons/sparkle.svg and close.svg, re-gridded from
// their native (non-24) viewBoxes onto a shared grid so the two morph
// correctly instead of reading the size gap as spurious rotation — same
// reasoning as searchArrowIcons.ts.
export const SPARKLE_ICON = fitIcon(
  "M6.18382 0.43749C6.33591 -0.14583 7.16409 -0.14583 7.31618 0.43749L8.07175 3.33544C8.33901 4.36049 9.13951 5.16099 10.1646 5.42825L13.0625 6.18382C13.6458 6.33591 13.6458 7.16409 13.0625 7.31618L10.1646 8.07175C9.13951 8.33901 8.33901 9.13951 8.07175 10.1646L7.31618 13.0625C7.16409 13.6458 6.33591 13.6458 6.18382 13.0625L5.42825 10.1646C5.16099 9.13951 4.36049 8.33901 3.33544 8.07175L0.43749 7.31618C-0.14583 7.16409 -0.14583 6.33591 0.43749 6.18382L3.33544 5.42825C4.36049 5.16099 5.16099 4.36049 5.42825 3.33544L6.18382 0.43749Z",
  14,
);

/**
 * Not sourced from close.svg like SPARKLE_ICON is from sparkle.svg — that
 * asset's arms came out visibly heavier than the search/send button's
 * stroke-width-2-on-24 icons next to it, and there's no `strokeWidth` knob
 * to turn since fill-drawn silhouettes bake their own weight into the
 * geometry (see the fill/stroke override on the MorphIcon below). Authored
 * directly on the 24x24 grid instead — two round-capped bars (half-width 1,
 * matching a ~2 stroke-width visually once tapered to a fill) along the
 * same corner-reaching diagonals close.svg used, built from two SVG arcs
 * per bar rather than by hand-fitting Bézier control points.
 */
export const CLOSE_ICON =
  "M 4.5071,3.0929 L 20.9071,19.4929 A 1,1 0 0 1 19.4929,20.9071 L 3.0929,4.5071 A 1,1 0 0 1 4.5071,3.0929 Z M 20.9071,4.5071 L 4.5071,20.9071 A 1,1 0 0 1 3.0929,19.4929 L 19.4929,3.0929 A 1,1 0 0 1 20.9071,4.5071 Z";

/** Same four Figma gradient stops as AI_GRADIENT (SearchPanel.tsx), as an
 * SVG paint server — a CSS `linear-gradient()` string can't fill an SVG
 * path, so this is the id referenced by `fill="url(#ASK_AI_GRADIENT_ID)"`. */
export const ASK_AI_GRADIENT_ID = "ask-ai-icon-gradient";
