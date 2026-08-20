"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { imageStyle } from "@/components/ui/placeholder";

export type CategoryTile = {
  id: string;
  title: string;
  /** Optional second line — "Need ideas?" uses it for the property count. */
  subtitle?: string;
  image?: string;
  /** Where the card navigates. "#" (a real, focusable, keyboard-reachable
   * link to nowhere) when omitted — "Stay like a local"'s cards don't have
   * a destination yet; "Need ideas?"'s do, straight to that place's search
   * results, so it sets this explicitly. */
  href?: string;
};

/** Card width from Figma, plus the row's own gap — used to page the track by
 * whole cards and to decide whether arrows are worth showing at all. */
const CARD_W = 285;
const GAP = 20;

/**
 * Four photo tiles under a title. Covers both "Stay like a local in any
 * location" (title only, 20px radius) and "Need ideas?" (title + subtitle,
 * 16px radius) — the only differences between them in Figma.
 *
 * Prev/Next arrows (same SectionHeader affordance PropertyCarousel uses)
 * appear only when there's actually something to scroll TO — more tiles than
 * fit in one row. "Need ideas?" always hands this exactly 4, so it never
 * grows the arrows; "Stay like a local" now hands it every real property
 * type LiteAPI has (dozens), so it does.
 */
export function CategoryGrid({
  title,
  tiles,
  radius = 20,
}: {
  title: string;
  tiles: CategoryTile[];
  radius?: 16 | 20;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  // Starts true (nothing to scroll), not false: sync() corrects this on
  // mount once it can actually measure the track, but until then this is
  // what keeps a 4-tile row — which never needs arrows — from flashing a
  // pair of them for one frame before they'd disappear again.
  const [atEnd, setAtEnd] = useState(true);

  const sync = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 1);
    // 1px of slack keeps sub-pixel widths from leaving the button enabled.
    setAtEnd(el.scrollLeft >= el.scrollWidth - el.clientWidth - 1);
  }, []);

  useEffect(() => {
    sync();
    const el = trackRef.current;
    if (!el) return;
    const observer = new ResizeObserver(sync);
    observer.observe(el);
    return () => observer.disconnect();
  }, [sync, tiles.length]);

  const scrollByPage = (dir: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    const step = CARD_W + GAP;
    const cards = Math.max(1, Math.floor(el.clientWidth / step));
    el.scrollBy({ left: dir * cards * step, behavior: "smooth" });
  };

  // Whether scrolling is even possible yet — the ResizeObserver hasn't
  // necessarily run on the very first paint, and `false` here (rather than
  // defaulting arrows to visible) is what keeps a 4-tile grid arrow-free
  // instead of flashing a pair of dead buttons before sync() catches up.
  const canScroll = !atStart || !atEnd;

  return (
    <section className="flex flex-col gap-5">
      <SectionHeader
        title={title}
        onPrev={canScroll ? () => scrollByPage(-1) : undefined}
        onNext={canScroll ? () => scrollByPage(1) : undefined}
        prevDisabled={atStart}
        nextDisabled={atEnd}
      />

      <div
        ref={trackRef}
        onScroll={sync}
        className="no-scrollbar -mx-5 flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-smooth px-5 sm:mx-0 sm:px-0"
      >
        {tiles.map((tile) => (
          <a
            key={tile.id}
            href={tile.href ?? "#"}
            style={{ borderRadius: radius, width: CARD_W }}
            className="group relative flex h-[280px] shrink-0 snap-start flex-col justify-end overflow-hidden p-4"
          >
            <span
              aria-hidden
              className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-[1.04]"
              style={imageStyle(tile.image, tile.id)}
            />
            {/* Figma: transparent until 50.5%, then down to rgba(0,5,25,.9). */}
            <span
              aria-hidden
              className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,5,25,0)_50.545%,rgba(0,5,25,0.9)_100%)]"
            />

            <span className="relative flex flex-col gap-1 text-white">
              <span className="font-display text-[20px] font-bold tracking-[-0.4px]">
                {tile.title}
              </span>
              {tile.subtitle && (
                <span className="font-display text-[14px] tracking-[-0.28px] opacity-90">
                  {tile.subtitle}
                </span>
              )}
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}
