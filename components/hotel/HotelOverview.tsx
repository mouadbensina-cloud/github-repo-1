"use client";

import { Icon, type IconName } from "@/components/ui/Icon";
import {
  FACILITY_ROW_LIMIT,
  type HotelFacility,
  type HotelHighlight,
} from "@/lib/hotel-data";

/** The section heading used down the whole left column. */
export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-display text-[20px] leading-[normal] font-bold text-[#0d121c]">
      {children}
    </h2>
  );
}

/**
 * "Smart highlights" — the hotel's strongest review categories, each with the
 * API's own one-line explanation.
 *
 * Renders NOTHING when there are no highlights: no heading, no empty frame,
 * no "coming soon". A hotel with too few reviews to analyse has no
 * sentiment_analysis at all, and the page should simply not have this section
 * rather than advertise a gap. The caller relies on that — it drops the
 * surrounding divider too (see the page).
 */
export function SmartHighlights({ highlights }: { highlights: HotelHighlight[] }) {
  if (!highlights.length) return null;

  return (
    <section className="flex flex-col gap-6">
      <SectionTitle>Smart highlights</SectionTitle>

      <div className="flex flex-col gap-6">
        {highlights.map((highlight) => (
          <div key={highlight.title} className="flex items-start gap-[10px]">
            <span className="mt-[2px] shrink-0 text-brand">
              <Icon name="sparkles" size={16} />
            </span>
            <div className="flex min-w-0 flex-col gap-[6px]">
              <p className="font-display text-[16px] font-medium tracking-[-0.16px] text-neutral-800">
                {highlight.title}
              </p>
              <p className="text-[14px] leading-[22px] tracking-[-0.14px] text-neutral-500">
                {highlight.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * The single-row facilities strip. `facilities` arrives already prioritized
 * and de-duplicated (see mapFacilities) — this only takes the first row's
 * worth and reports the hotel's true total on the link, which is why the
 * count on "See all facilities" is usually much larger than the six shown.
 */
export function PopularFacilities({
  facilities,
  total,
}: {
  facilities: HotelFacility[];
  total: number;
}) {
  if (!facilities.length) return null;

  const shown = facilities.slice(0, FACILITY_ROW_LIMIT);

  return (
    <section className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-4">
        <SectionTitle>Popular facilities</SectionTitle>
        <button
          type="button"
          className="shrink-0 cursor-pointer rounded-[10px] py-[9px] font-display text-[14px] font-medium tracking-[-0.112px] text-[#0d121c] drop-shadow-[0px_1px_1px_rgba(16,24,40,0.05)] focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none"
        >
          See all facilities{total > shown.length ? ` (${total})` : ""}
        </button>
      </div>

      <ul className="flex flex-wrap items-center gap-5">
        {shown.map((facility) => (
          <li
            key={facility.label}
            className="flex items-center gap-[6px] text-[14px] tracking-[-0.14px] text-[#384250]"
          >
            <Icon
              name={facility.icon as IconName}
              size={16}
              className="shrink-0 text-[#384250]"
            />
            {facility.label}
          </li>
        ))}
      </ul>
    </section>
  );
}
