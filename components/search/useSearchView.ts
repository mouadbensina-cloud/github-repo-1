"use client";

import { useState } from "react";

export type SearchView = "map" | "list";

/**
 * Drives the search results page's map<->list morph. Same technique as the
 * hero's useHeroCollapse/useHeroChat — flip one number (--view-p, 0 or 1)
 * and let a CSS `transition` on that registered custom property carry the
 * whole thing, triggered by clicking List/Map rather than scroll or Enter.
 *
 * See the geometry block at the end of globals.css for what actually reads
 * --view-p, and --view-out/--view-in for the two derived opacity curves —
 * identical shape to --cf/--ci and --chat-out/--chat-in.
 */
export function useSearchView(initial: SearchView = "map") {
  const [view, setViewState] = useState<SearchView>(initial);

  const setView = (next: SearchView) => {
    document.documentElement.style.setProperty(
      "--view-p",
      next === "list" ? "1" : "0",
    );
    setViewState(next);
  };

  return { view, setView };
}
