"use client";

import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import type { HotelDetail } from "@/lib/hotel-data";

/**
 * Name, class, address and the two chrome actions — the top two rows of
 * Figma's "Container" (33370:242597), which also holds the gallery as a
 * third row under the same 20px gap. That's why this returns a Fragment
 * rather than its own wrapping div: HotelPage nests it directly alongside
 * HotelGallery inside ONE flex column, so all three rows share that single
 * 20px rhythm instead of this component inventing its own.
 *
 * Save and the Map link are deliberately inert for now — real buttons with
 * real focus rings and hover states, wired to nothing, because the modals
 * they eventually open aren't in scope. They're `<button>`s rather than
 * styled divs so keyboard users reach them in the right order and the
 * affordance doesn't have to be rebuilt when the modals land.
 */
export function HotelHeader({
  hotel,
  backHref,
}: {
  hotel: HotelDetail;
  /** Preserves the search that led here, so "Search results" returns to it
   * rather than to a bare, criteria-less results page. */
  backHref: string;
}) {
  return (
    <>
      <Link
        href={backHref}
        className="flex w-fit items-center gap-3 transition-opacity hover:opacity-70"
      >
        <span className="flex size-8 items-center justify-center rounded-full border border-neutral-200 bg-white">
          {/* One chevron asset for every direction in this codebase — see
              SectionHeader, which rotates the same glyph. Figma's own export
              for this one specific glyph is rotate(-90) THEN scaleY(-1), not
              the plain +90 rotation used elsewhere — matched exactly rather
              than assumed identical, since a symmetric-looking chevron can
              still read subtly different mirrored vs. not. */}
          <Icon
            name="chevron-down"
            size={22}
            style={{ transform: "rotate(-90deg) scaleY(-1)" }}
          />
        </span>
        <span className="font-display text-[16px] font-medium tracking-[-0.32px] text-[#4d5761]">
          Search results
        </span>
      </Link>

      <div className="flex items-end justify-between gap-6">
        <div className="flex min-w-0 flex-col gap-[10px]">
          <div className="flex flex-wrap items-center gap-4">
            {/* Names run long (80+ characters happens); this wraps and the
                stars stay on the same visual line rather than being pushed
                off the row or forcing a truncation that hides the brand. */}
            <h1 className="font-display text-[24px] leading-[normal] font-bold tracking-[-0.24px] text-black">
              {hotel.name}
            </h1>

            {/* 0 = unrated. An empty star row reads as "rated zero", which is
                a different and wrong claim, so the whole thing is dropped. */}
            {hotel.stars > 0 ? (
              <span
                className="flex shrink-0 items-center gap-[3px] text-[#f5a623]"
                aria-label={`${hotel.stars}-star hotel`}
              >
                {Array.from({ length: hotel.stars }, (_, index) => (
                  <Icon key={index} name="star" size={12} />
                ))}
              </span>
            ) : null}
          </div>

          {hotel.address ? (
            <div className="flex flex-wrap items-center gap-[10px] text-[14px] tracking-[-0.28px]">
              <span className="flex items-center gap-[6px]">
                <Icon name="pin" size={20} className="shrink-0 text-[#4d5761]" />
                <span className="text-[#4d5761]">{hotel.address}</span>
              </span>
              <Icon name="dot" size={4} className="shrink-0 text-neutral-400" />
              <button
                type="button"
                className="cursor-pointer font-medium text-brand underline underline-offset-2 focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none"
              >
                Map
              </button>
            </div>
          ) : null}
        </div>

        <button
          type="button"
          className="flex shrink-0 cursor-pointer items-center gap-[6px] rounded-[10px] border border-neutral-200 bg-white px-[14px] py-[9px] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] font-display text-[14px] font-medium tracking-[-0.112px] text-[#0d121c] transition-colors hover:bg-surface focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none"
        >
          <Icon name="heart" size={16} />
          Save
        </button>
      </div>
    </>
  );
}
