"use client";

import { useState, type ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";

type FilterOption = { id: string; label: string; count: number };

const GUEST_RATING: FilterOption[] = [
  { id: "excellent", label: "Excellent : 4+", count: 15 },
  { id: "very-good", label: "Very good : 3+", count: 15 },
  { id: "good", label: "Good : 2+", count: 15 },
  { id: "pleasant", label: "Pleasant", count: 15 },
];

const MEALS: FilterOption[] = [
  { id: "breakfast", label: "Breakfast included", count: 32 },
  { id: "half-board", label: "Half board", count: 12 },
  { id: "full-board", label: "Full board", count: 8 },
  { id: "all-inclusive", label: "All inclusive", count: 5 },
];

const FACILITIES: FilterOption[] = [
  { id: "wifi", label: "Free WiFi", count: 41 },
  { id: "pool", label: "Swimming pool", count: 18 },
  { id: "parking", label: "Free parking", count: 23 },
  { id: "ac", label: "Air conditioning", count: 27 },
  { id: "gym", label: "Fitness center", count: 14 },
];

/** Decorative histogram behind the price slider — a plausible price-distribution
 * shape, not real data (there's no booking backend yet to bucket prices from). */
const PRICE_HISTOGRAM = [
  2, 2, 3, 4, 5, 8, 13, 18, 22, 26, 29, 29, 29, 29, 28, 26, 20, 20, 22, 15, 11,
  11, 8, 8, 4, 3, 4, 3, 3, 3, 3, 5,
];

/**
 * The left filter panel for list mode (Figma 33166:238345). Every control here
 * is wired to its own local state — expand/collapse, checkboxes, radios, the
 * min/max price fields — but none of it actually filters SEARCH_RESULTS yet,
 * same as the top chip row it replaces. The price range slider is
 * static/non-draggable for the same reason: a real dual-thumb range slider is
 * a chunk of work on its own, and nothing here is wired to a backend to filter
 * against yet — the property-rating slider is a single value though, so that
 * one gets a real (visually-hidden) range input driving the decoration.
 *
 * Sized to `h-full` so the sticky wrapper in SearchPage can cap its height to
 * the viewport and let this scroll internally — without h-full there's no
 * height for overflow-y-auto to actually clip against, and the panel would
 * just grow the whole page instead of the intended own-scrollbar behaviour.
 */
export function FilterSidebar() {
  return (
    <aside className="flex h-full w-[260px] shrink-0 flex-col overflow-y-auto rounded-[16px] border border-neutral-200 bg-white">
      <div className="flex h-14 w-full shrink-0 items-center justify-between px-5">
        <p className="font-display text-[18px] font-bold text-neutral-900">
          Filter
        </p>
        <button
          type="button"
          className="cursor-pointer font-display text-[12px] text-[#384250] underline"
        >
          Clear filters
        </button>
      </div>
      <div className="h-px w-full bg-neutral-200" />

      <div className="flex flex-col gap-2 px-5 py-4">
        <p className="font-display text-[15px] font-medium text-neutral-900">
          Hotel name
        </p>
        <input
          type="text"
          placeholder="For example: Hilton"
          className="h-11 w-full rounded-[8px] border border-neutral-200 bg-white px-3.5 font-display text-[14px] text-neutral-900 shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] placeholder:text-neutral-500 focus:border-brand focus:outline-none"
        />
      </div>

      <RadioGroup />

      <div className="h-px w-full bg-neutral-200" />
      <FilterAccordion label="Guest rating">
        <CheckboxList options={GUEST_RATING} />
      </FilterAccordion>

      <div className="h-px w-full bg-neutral-200" />
      <FilterAccordion label="Price" sublabel="(per night)">
        <PriceRange />
      </FilterAccordion>

      <div className="h-px w-full bg-neutral-200" />
      <FilterAccordion label="Property rating">
        <PropertyRatingSlider />
      </FilterAccordion>

      <div className="h-px w-full bg-neutral-200" />
      <FilterAccordion label="Meals">
        <CheckboxList options={MEALS} />
      </FilterAccordion>

      <div className="h-px w-full bg-neutral-200" />
      <FilterAccordion label="Facilities">
        <CheckboxList options={FACILITIES} />
      </FilterAccordion>
    </aside>
  );
}

function RadioGroup() {
  const [value, setValue] = useState<"show-all" | "free-cancellation">(
    "show-all",
  );
  return (
    <div className="flex flex-col gap-1 px-5 pb-4">
      {(
        [
          { id: "show-all", label: "Show all" },
          { id: "free-cancellation", label: "Free cancelation only" },
        ] as const
      ).map((option) => (
        <label
          key={option.id}
          className="flex h-[30px] w-full cursor-pointer items-center gap-3"
        >
          <input
            type="radio"
            name="availability"
            checked={value === option.id}
            onChange={() => setValue(option.id)}
            className="size-4 accent-[#4951ef]"
          />
          <span className="font-display text-[14px] text-[#384250]">
            {option.label}
          </span>
        </label>
      ))}
    </div>
  );
}

function FilterAccordion({
  label,
  sublabel,
  children,
}: {
  label: string;
  sublabel?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="flex w-full flex-col gap-2 px-5 py-3.5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-baseline justify-between gap-1"
      >
        <span className="flex items-baseline gap-1">
          <span className="font-display text-[15px] font-medium text-neutral-900">
            {label}
          </span>
          {sublabel ? (
            <span className="font-display text-[14px] text-[#4d5761]">
              {sublabel}
            </span>
          ) : null}
        </span>
        <Icon
          name="chevron-down"
          size={16}
          className={`shrink-0 text-neutral-500 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open ? children : null}
    </div>
  );
}

function CheckboxList({ options }: { options: FilterOption[] }) {
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="flex w-full flex-col items-start">
      {options.map((option) => (
        <label
          key={option.id}
          className="flex h-[30px] w-full cursor-pointer items-center gap-3"
        >
          <input
            type="checkbox"
            checked={checked.has(option.id)}
            onChange={() => toggle(option.id)}
            className="size-4 rounded-[4px] accent-[#4951ef]"
          />
          <span className="font-display text-[14px] whitespace-nowrap text-[#384250]">
            {option.label} ({option.count})
          </span>
        </label>
      ))}
    </div>
  );
}

function PriceRange() {
  const [min, setMin] = useState("251");
  const [max, setMax] = useState("849");

  return (
    <div className="flex w-full flex-col gap-4 px-1.5">
      <div className="flex w-full flex-col gap-1">
        <div className="flex h-8 w-full items-end gap-[2px]">
          {PRICE_HISTOGRAM.map((h, i) => (
            <span
              key={i}
              className="min-w-px flex-1 rounded-t-[1px] bg-[#e8e6ed]"
              style={{ height: `${h}px` }}
            />
          ))}
        </div>
        <div className="relative h-[21px] w-full rounded-[8px]">
          <div className="absolute top-1/2 right-0 left-0 h-1 -translate-y-1/2 bg-[#e8e6ed]" />
          <div className="absolute top-1/2 left-[20%] h-1 w-[60%] -translate-y-1/2 rounded-full bg-brand" />
          <span className="absolute top-1/2 left-[20%] size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-brand bg-white shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]" />
          <span className="absolute top-1/2 left-[80%] size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-brand bg-white shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]" />
        </div>
      </div>

      <div className="flex w-full items-start gap-6">
        <label className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="font-display text-[12px] text-[#4d5761]">Min</span>
          <input
            type="text"
            value={`$${min}`}
            onChange={(e) => setMin(e.target.value.replace(/\D/g, ""))}
            className="h-8 w-full rounded-[10px] border border-neutral-300 bg-white px-3 font-display text-[14px] text-neutral-900 shadow-[0px_1px_1px_0px_rgba(16,24,40,0.05)] focus:border-brand focus:outline-none"
          />
        </label>
        <label className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="font-display text-[12px] text-[#4d5761]">Max</span>
          <input
            type="text"
            value={`$${max}`}
            onChange={(e) => setMax(e.target.value.replace(/\D/g, ""))}
            className="h-8 w-full rounded-[10px] border border-neutral-300 bg-white px-3 font-display text-[14px] text-neutral-900 shadow-[0px_1px_1px_0px_rgba(16,24,40,0.05)] focus:border-brand focus:outline-none"
          />
        </label>
      </div>
    </div>
  );
}

/** 1 sits at 20% and 5 at 100% — the reference mockup never parks the thumb
 * flush with the track's left edge, even at the minimum value. */
function ratingToPercent(rating: number) {
  return (rating / 5) * 100;
}

function PropertyRatingSlider() {
  const [rating, setRating] = useState(3);
  const percent = ratingToPercent(rating);

  return (
    <div className="flex w-[220px] flex-col items-end px-1.5">
      <div className="relative h-[39px] w-full">
        <div
          className="absolute flex -translate-x-1/2 flex-col items-center drop-shadow-[0_4px_3px_rgba(16,24,40,0.03)]"
          style={{ left: `${percent}%` }}
        >
          <span className="flex items-center gap-1 rounded-[8px] bg-brand px-2.5 py-2">
            {/* star.svg's native box (12.4342 x 11.9033) isn't quite square —
                sizing both dimensions equally via `size` alone stretches it
                slightly, since the raw SVG uses preserveAspectRatio="none". */}
            <Icon
              name="star"
              size={13}
              style={{ height: 12.45 }}
              className="text-white"
            />
            <span className="font-display text-[15px] font-bold text-white">
              {rating}
            </span>
          </span>
          <svg
            width="12"
            height="6"
            viewBox="0 0 12 6"
            aria-hidden
            className="-mt-px"
          >
            <path d="M0 0H12L6 6L0 0Z" fill="#4951ef" />
          </svg>
        </div>
      </div>
      <div className="relative h-6 w-full">
        <div className="absolute top-1/2 right-0 left-0 h-1 -translate-y-1/2 rounded-full bg-neutral-200" />
        <div
          className="absolute top-1/2 left-0 h-1 -translate-y-1/2 rounded-full bg-brand"
          style={{ width: `${percent}%` }}
        />
        <span
          className="pointer-events-none absolute top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-brand bg-white shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]"
          style={{ left: `${percent}%` }}
        />
        <input
          type="range"
          min={1}
          max={5}
          step={1}
          value={rating}
          onChange={(e) => setRating(Number(e.target.value))}
          aria-label="Minimum property rating"
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </div>
    </div>
  );
}
