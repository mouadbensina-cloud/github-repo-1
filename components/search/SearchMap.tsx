"use client";

import dynamic from "next/dynamic";
import type { Hotel } from "@/lib/search-data";

// mapbox-gl touches `window` at module load, which breaks Next's server
// render pass — ssr:false keeps the whole module out of that pass entirely
// rather than just guarding the effect that uses it.
const SearchMapInner = dynamic(
  () => import("./SearchMapInner").then((mod) => mod.SearchMapInner),
  {
    ssr: false,
    loading: () => (
      <div className="flex size-full items-center justify-center bg-surface text-[13px] text-neutral-500">
        Loading map…
      </div>
    ),
  },
);

export function SearchMap(props: {
  hotels: Hotel[];
  selectedId?: string | null;
  hoveredId?: string | null;
  onSelectHotel?: (id: string | null) => void;
}) {
  return (
    <div className="relative size-full overflow-hidden rounded-[24px] border border-neutral-200">
      <SearchMapInner {...props} />
    </div>
  );
}
