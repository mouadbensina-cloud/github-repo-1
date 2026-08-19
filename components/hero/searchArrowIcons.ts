import { fitIcon } from "morphicons";

// Same path data as public/icons/search.svg and arrow-right.svg — re-gridded
// from their native (non-24) viewBoxes so the two morph on a shared grid
// (mixing unfitted grids reads the scale gap as spurious rotation). Computed
// once at module scope per morphicons' own caching guidance.
export const SEARCH_ICON = fitIcon(
  "M15.75 15.75L12.4875 12.4875M14.25 8.25C14.25 11.5637 11.5637 14.25 8.25 14.25C4.93629 14.25 2.25 11.5637 2.25 8.25C2.25 4.93629 4.93629 2.25 8.25 2.25C11.5637 2.25 14.25 4.93629 14.25 8.25Z",
  18,
);

export const ARROW_RIGHT_ICON = fitIcon(
  "M10.0001 4.16536L15.8334 9.9987L10.0001 15.832M15.8334 9.9987L4.16675 9.9987",
  20,
);
