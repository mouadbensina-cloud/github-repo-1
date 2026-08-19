import { useLayoutEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";

const AMENITY_CHIPS = [
  "Airport transfers",
  "Day trips",
  "Sightseeing",
  "Free parking",
  "Pool",
];

/**
 * Results count + sort + list/map toggle, and the filter chip row below it —
 * list mode replaces that row's job with FilterSidebar instead, so it morphs
 * out via .search-chip-row (see globals.css) rather than being hidden
 * outright, in step with the sidebar/map morph. Sort and the chips aren't
 * wired to any real filtering yet, same as the home page's suggestion pills;
 * the list/map toggle is the one real control, switching SearchPage's view.
 */
export function SearchResultsHeader({
  count,
  city,
  view,
  onViewChange,
}: {
  /** null when there is no trustworthy total to show — still loading, or the
   * search failed. Rendering "0 properties in X" in those cases would state
   * as fact that the city has nothing available, which is a different (and
   * wrong) claim from "we don't have results". */
  count: number | null;
  city: string;
  view: "map" | "list";
  onViewChange: (view: "map" | "list") => void;
}) {
  return (
    <div className="flex w-full flex-col">
      <div className="flex w-full items-center justify-between">
        <p className="font-display text-[16px] font-semibold tracking-[0.08px] text-neutral-900">
          {count === null
            ? `Hotels in ${city}`
            : `${count} propert${count === 1 ? "y" : "ies"} in ${city}`}
        </p>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            className="flex h-9 shrink-0 cursor-pointer items-center gap-2 px-3 py-2 font-display text-[13px] font-medium whitespace-nowrap text-neutral-900"
          >
            Sort By: our top picks
            <Icon name="sort" size={18} className="text-neutral-500" />
          </button>

          <ViewToggle view={view} onViewChange={onViewChange} />
        </div>
      </div>

      <div
        className="search-chip-row no-scrollbar mt-6 flex w-full items-center gap-2.5 overflow-x-auto"
        inert={view === "list"}
      >
        <button
          type="button"
          className="flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-[8px] border border-neutral-200 px-3 py-2 font-display text-[13px] font-medium whitespace-nowrap text-neutral-900"
        >
          <Icon name="filters" size={16} className="text-neutral-500" />
          Filters
        </button>

        <span className="h-7 w-px shrink-0 rounded bg-neutral-200" />

        {AMENITY_CHIPS.map((chip) => (
          <button
            key={chip}
            type="button"
            className="flex h-9 shrink-0 cursor-pointer items-center rounded-[8px] border border-neutral-200 px-3 py-2 font-display text-[13px] font-medium whitespace-nowrap text-neutral-900"
          >
            {chip}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * The active-tab background is one shared pill sliding between List/Map
 * (Figma 33198:29690 / 33198:29732 — two Smart Animate frames where the same
 * "Rectangle 40019" just moves), not each tab toggling its own background —
 * a per-tab bg-white swap would just pop instead of sliding. Measuring each
 * button's own rect rather than hardcoding pixel positions means it keeps
 * working if the copy, font, or icon sizing ever changes.
 */
function ViewToggle({
  view,
  onViewChange,
}: {
  view: "map" | "list";
  onViewChange: (view: "map" | "list") => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLButtonElement>(null);
  const mapRef = useRef<HTMLButtonElement>(null);
  const [pill, setPill] = useState<{ left: number; width: number }>();

  useLayoutEffect(() => {
    const container = containerRef.current;
    const active = (view === "list" ? listRef : mapRef).current;
    if (!container || !active) return;
    setPill({
      left: active.offsetLeft,
      width: active.offsetWidth,
    });
  }, [view]);

  return (
    <div
      ref={containerRef}
      className="relative flex shrink-0 items-center gap-1 rounded-[12px] bg-surface p-1"
    >
      {pill ? (
        <span
          aria-hidden
          className="view-toggle-pill absolute top-1 bottom-1 rounded-[8px] bg-white"
          style={{ left: pill.left, width: pill.width }}
        />
      ) : null}

      <button
        ref={mapRef}
        type="button"
        onClick={() => onViewChange("map")}
        aria-pressed={view === "map"}
        className={`relative z-10 flex cursor-pointer items-center gap-1.5 px-2 py-1.5 font-display text-[16px] font-medium transition-colors ${
          view === "map" ? "text-neutral-900" : "text-neutral-500"
        }`}
      >
        <Icon
          name="map"
          size={16}
          className={`transition-colors ${view === "map" ? "text-brand" : "text-neutral-400"}`}
        />
        Map
      </button>
      <button
        ref={listRef}
        type="button"
        onClick={() => onViewChange("list")}
        aria-pressed={view === "list"}
        className={`relative z-10 flex cursor-pointer items-center gap-1.5 px-2 py-1.5 font-display text-[16px] font-medium transition-colors ${
          view === "list" ? "text-neutral-900" : "text-neutral-500"
        }`}
      >
        <Icon
          name="list"
          size={16}
          className={`transition-colors ${view === "list" ? "text-brand" : "text-neutral-400"}`}
        />
        List
      </button>
    </div>
  );
}
