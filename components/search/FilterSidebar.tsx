"use client";

import { useState, useMemo, useCallback, useEffect, type ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import type { Hotel } from "@/lib/search-data";

export type Filters = {
  hotelName: string;
  freeCancellationOnly: boolean;
  minScore: number | null;
  priceMin: number | null;
  priceMax: number | null;
  minStars: number;
  breakfastIncluded: boolean;
};

export const INITIAL_FILTERS: Filters = {
  hotelName: "",
  freeCancellationOnly: false,
  minScore: null,
  priceMin: null,
  priceMax: null,
  minStars: 1,
  breakfastIncluded: false,
};

function priceToNumber(price: string): number {
  return Number(price.replace(/[^0-9.]/g, "")) || 0;
}

function scoreToNumber(score: string): number {
  return Number(score) || 0;
}

type RatingBucket = { id: string; label: string; minScore: number; count: number };
type StarBucket = { stars: number; count: number };

function deriveRatingBuckets(hotels: Hotel[]): RatingBucket[] {
  const thresholds: { id: string; label: string; min: number }[] = [
    { id: "exceptional", label: "Exceptional: 9+", min: 9 },
    { id: "excellent", label: "Excellent: 8+", min: 8 },
    { id: "very-good", label: "Very good: 7+", min: 7 },
    { id: "good", label: "Good: 6+", min: 6 },
  ];
  return thresholds
    .map((t) => ({
      id: t.id,
      label: t.label,
      minScore: t.min,
      count: hotels.filter((h) => scoreToNumber(h.score) >= t.min).length,
    }))
    .filter((b) => b.count > 0);
}

function deriveStarBuckets(hotels: Hotel[]): StarBucket[] {
  const counts = new Map<number, number>();
  for (const h of hotels) {
    if (h.stars >= 1) counts.set(h.stars, (counts.get(h.stars) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([stars, count]) => ({ stars, count }))
    .sort((a, b) => b.stars - a.stars);
}

function derivePriceRange(hotels: Hotel[]): { min: number; max: number } {
  if (hotels.length === 0) return { min: 0, max: 1000 };
  const prices = hotels.map((h) => priceToNumber(h.price)).filter((p) => p > 0);
  if (prices.length === 0) return { min: 0, max: 1000 };
  return { min: Math.min(...prices), max: Math.max(...prices) };
}

export function applyFilters(hotels: Hotel[], filters: Filters): Hotel[] {
  return hotels.filter((hotel) => {
    if (
      filters.hotelName &&
      !hotel.name.toLowerCase().includes(filters.hotelName.toLowerCase())
    )
      return false;

    if (filters.freeCancellationOnly && !hotel.freeCancellation) return false;

    if (
      filters.minScore !== null &&
      scoreToNumber(hotel.score) < filters.minScore
    )
      return false;

    const price = priceToNumber(hotel.price);
    if (filters.priceMin !== null && price < filters.priceMin) return false;
    if (filters.priceMax !== null && price > filters.priceMax) return false;

    if (filters.minStars > 1 && hotel.stars < filters.minStars) return false;

    if (filters.breakfastIncluded && !hotel.breakfastIncluded) return false;

    return true;
  });
}

export function FilterSidebar({
  hotels = [],
  filters = INITIAL_FILTERS,
  onFiltersChange,
}: {
  hotels: Hotel[];
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
}) {
  const ratingBuckets = useMemo(() => deriveRatingBuckets(hotels), [hotels]);
  const starBuckets = useMemo(() => deriveStarBuckets(hotels), [hotels]);
  const priceRange = useMemo(() => derivePriceRange(hotels), [hotels]);

  const breakfastCount = useMemo(
    () => hotels.filter((h) => h.breakfastIncluded).length,
    [hotels],
  );
  const freeCancelCount = useMemo(
    () => hotels.filter((h) => h.freeCancellation).length,
    [hotels],
  );

  const update = useCallback(
    (patch: Partial<Filters>) => onFiltersChange({ ...filters, ...patch }),
    [filters, onFiltersChange],
  );

  const hasActiveFilters =
    filters.hotelName !== "" ||
    filters.freeCancellationOnly ||
    filters.minScore !== null ||
    filters.priceMin !== null ||
    filters.priceMax !== null ||
    filters.minStars > 1 ||
    filters.breakfastIncluded;

  return (
    <aside className="flex h-full w-[260px] shrink-0 flex-col overflow-y-auto rounded-[16px] border border-neutral-200 bg-white">
      <div className="flex h-14 w-full shrink-0 items-center justify-between px-5">
        <p className="font-display text-[18px] font-bold text-neutral-900">
          Filter
        </p>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={() => onFiltersChange(INITIAL_FILTERS)}
            className="cursor-pointer font-display text-[12px] text-[#384250] underline"
          >
            Clear filters
          </button>
        )}
      </div>
      <div className="h-px w-full bg-neutral-200" />

      <div className="flex flex-col gap-2 px-5 py-4">
        <p className="font-display text-[15px] font-medium text-neutral-900">
          Hotel name
        </p>
        <input
          type="text"
          placeholder="For example: Hilton"
          value={filters.hotelName}
          onChange={(e) => update({ hotelName: e.target.value })}
          className="h-11 w-full rounded-[8px] border border-neutral-200 bg-white px-3.5 font-display text-[14px] text-neutral-900 shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] placeholder:text-neutral-500 focus:border-brand focus:outline-none"
        />
      </div>

      {freeCancelCount > 0 && (
        <CancellationRadio
          value={filters.freeCancellationOnly}
          count={freeCancelCount}
          onChange={(v) => update({ freeCancellationOnly: v })}
        />
      )}

      {ratingBuckets.length > 0 && (
        <>
          <div className="h-px w-full bg-neutral-200" />
          <FilterAccordion label="Guest rating">
            <RatingCheckboxes
              buckets={ratingBuckets}
              selected={filters.minScore}
              onChange={(v) => update({ minScore: v })}
            />
          </FilterAccordion>
        </>
      )}

      <div className="h-px w-full bg-neutral-200" />
      <FilterAccordion label="Price" sublabel="(per night)">
        <PriceRange
          absMin={priceRange.min}
          absMax={priceRange.max}
          currentMin={filters.priceMin ?? priceRange.min}
          currentMax={filters.priceMax ?? priceRange.max}
          onChange={(min, max) =>
            update({
              priceMin: min <= priceRange.min ? null : min,
              priceMax: max >= priceRange.max ? null : max,
            })
          }
          hotels={hotels}
        />
      </FilterAccordion>

      {starBuckets.length > 0 && (
        <>
          <div className="h-px w-full bg-neutral-200" />
          <FilterAccordion label="Property rating">
            <PropertyRatingSlider
              value={filters.minStars}
              maxStars={Math.max(...starBuckets.map((b) => b.stars))}
              onChange={(v) => update({ minStars: v })}
            />
          </FilterAccordion>
        </>
      )}

      {breakfastCount > 0 && (
        <>
          <div className="h-px w-full bg-neutral-200" />
          <FilterAccordion label="Meals">
            <label className="flex h-[30px] w-full cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={filters.breakfastIncluded}
                onChange={() =>
                  update({ breakfastIncluded: !filters.breakfastIncluded })
                }
                className="size-4 rounded-[4px] accent-[#4951ef]"
              />
              <span className="font-display text-[14px] whitespace-nowrap text-[#384250]">
                Breakfast included ({breakfastCount})
              </span>
            </label>
          </FilterAccordion>
        </>
      )}
    </aside>
  );
}

function CancellationRadio({
  value,
  count,
  onChange,
}: {
  value: boolean;
  count: number;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex flex-col gap-1 px-5 pb-4">
      <label className="flex h-[30px] w-full cursor-pointer items-center gap-3">
        <input
          type="radio"
          name="availability"
          checked={!value}
          onChange={() => onChange(false)}
          className="size-4 accent-[#4951ef]"
        />
        <span className="font-display text-[14px] text-[#384250]">
          Show all
        </span>
      </label>
      <label className="flex h-[30px] w-full cursor-pointer items-center gap-3">
        <input
          type="radio"
          name="availability"
          checked={value}
          onChange={() => onChange(true)}
          className="size-4 accent-[#4951ef]"
        />
        <span className="font-display text-[14px] text-[#384250]">
          Free cancellation only ({count})
        </span>
      </label>
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

function RatingCheckboxes({
  buckets,
  selected,
  onChange,
}: {
  buckets: RatingBucket[];
  selected: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <div className="flex w-full flex-col items-start">
      {buckets.map((bucket) => (
        <label
          key={bucket.id}
          className="flex h-[30px] w-full cursor-pointer items-center gap-3"
        >
          <input
            type="checkbox"
            checked={selected === bucket.minScore}
            onChange={() =>
              onChange(selected === bucket.minScore ? null : bucket.minScore)
            }
            className="size-4 rounded-[4px] accent-[#4951ef]"
          />
          <span className="font-display text-[14px] whitespace-nowrap text-[#384250]">
            {bucket.label} ({bucket.count})
          </span>
        </label>
      ))}
    </div>
  );
}

function PriceRange({
  absMin,
  absMax,
  currentMin,
  currentMax,
  onChange,
  hotels,
}: {
  absMin: number;
  absMax: number;
  currentMin: number;
  currentMax: number;
  onChange: (min: number, max: number) => void;
  hotels: Hotel[];
}) {
  const [localMin, setLocalMin] = useState(String(Math.round(currentMin)));
  const [localMax, setLocalMax] = useState(String(Math.round(currentMax)));

  useEffect(() => {
    setLocalMin(String(Math.round(currentMin)));
    setLocalMax(String(Math.round(currentMax)));
  }, [currentMin, currentMax]);

  const BUCKET_COUNT = 32;
  const histogram = useMemo(() => {
    if (absMax <= absMin) return Array(BUCKET_COUNT).fill(0) as number[];
    const buckets = Array(BUCKET_COUNT).fill(0) as number[];
    const range = absMax - absMin;
    for (const h of hotels) {
      const p = priceToNumber(h.price);
      if (p <= 0) continue;
      const idx = Math.min(
        Math.floor(((p - absMin) / range) * BUCKET_COUNT),
        BUCKET_COUNT - 1,
      );
      buckets[idx]++;
    }
    const maxCount = Math.max(...buckets, 1);
    return buckets.map((c) => Math.round((c / maxCount) * 30));
  }, [hotels, absMin, absMax]);

  const range = absMax - absMin || 1;
  const leftPct = ((currentMin - absMin) / range) * 100;
  const rightPct = ((currentMax - absMin) / range) * 100;

  const commitMin = () => {
    const v = Math.max(absMin, Math.min(Number(localMin) || absMin, currentMax));
    setLocalMin(String(Math.round(v)));
    onChange(v, currentMax);
  };
  const commitMax = () => {
    const v = Math.min(absMax, Math.max(Number(localMax) || absMax, currentMin));
    setLocalMax(String(Math.round(v)));
    onChange(currentMin, v);
  };

  return (
    <div className="flex w-full flex-col gap-4 px-1.5">
      <div className="flex w-full flex-col gap-1">
        <div className="flex h-8 w-full items-end gap-[2px]">
          {histogram.map((h, i) => {
            const bucketLow = absMin + (i / BUCKET_COUNT) * range;
            const bucketHigh = absMin + ((i + 1) / BUCKET_COUNT) * range;
            const inRange = bucketLow >= currentMin && bucketHigh <= currentMax;
            return (
              <span
                key={i}
                className={`min-w-px flex-1 rounded-t-[1px] ${inRange ? "bg-brand/40" : "bg-[#e8e6ed]"}`}
                style={{ height: `${Math.max(h, 2)}px` }}
              />
            );
          })}
        </div>
        <div className="relative h-[21px] w-full">
          <div className="absolute top-1/2 right-0 left-0 h-1 -translate-y-1/2 bg-[#e8e6ed]" />
          <div
            className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-brand"
            style={{ left: `${leftPct}%`, width: `${rightPct - leftPct}%` }}
          />
          <input
            type="range"
            min={absMin}
            max={absMax}
            step={1}
            value={currentMin}
            onChange={(e) => {
              const v = Math.min(Number(e.target.value), currentMax);
              setLocalMin(String(Math.round(v)));
              onChange(v, currentMax);
            }}
            aria-label="Minimum price"
            className="pointer-events-none absolute inset-0 h-full w-full appearance-none bg-transparent [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:size-5 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-brand [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:size-5 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-brand [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]"
          />
          <input
            type="range"
            min={absMin}
            max={absMax}
            step={1}
            value={currentMax}
            onChange={(e) => {
              const v = Math.max(Number(e.target.value), currentMin);
              setLocalMax(String(Math.round(v)));
              onChange(currentMin, v);
            }}
            aria-label="Maximum price"
            className="pointer-events-none absolute inset-0 h-full w-full appearance-none bg-transparent [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:size-5 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-brand [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:size-5 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-brand [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]"
          />
        </div>
      </div>

      <div className="flex w-full items-start gap-6">
        <label className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="font-display text-[12px] text-[#4d5761]">Min</span>
          <input
            type="text"
            value={`$${localMin}`}
            onChange={(e) => setLocalMin(e.target.value.replace(/[^0-9]/g, ""))}
            onBlur={commitMin}
            onKeyDown={(e) => e.key === "Enter" && commitMin()}
            className="h-8 w-full rounded-[10px] border border-neutral-300 bg-white px-3 font-display text-[14px] text-neutral-900 shadow-[0px_1px_1px_0px_rgba(16,24,40,0.05)] focus:border-brand focus:outline-none"
          />
        </label>
        <label className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="font-display text-[12px] text-[#4d5761]">Max</span>
          <input
            type="text"
            value={`$${localMax}`}
            onChange={(e) => setLocalMax(e.target.value.replace(/[^0-9]/g, ""))}
            onBlur={commitMax}
            onKeyDown={(e) => e.key === "Enter" && commitMax()}
            className="h-8 w-full rounded-[10px] border border-neutral-300 bg-white px-3 font-display text-[14px] text-neutral-900 shadow-[0px_1px_1px_0px_rgba(16,24,40,0.05)] focus:border-brand focus:outline-none"
          />
        </label>
      </div>
    </div>
  );
}

function ratingToPercent(rating: number) {
  return (rating / 5) * 100;
}

function PropertyRatingSlider({
  value,
  maxStars,
  onChange,
}: {
  value: number;
  maxStars: number;
  onChange: (v: number) => void;
}) {
  const percent = ratingToPercent(value);

  return (
    <div className="flex w-[220px] flex-col items-end px-1.5">
      <div className="relative h-[39px] w-full">
        <div
          className="absolute flex -translate-x-1/2 flex-col items-center drop-shadow-[0_4px_3px_rgba(16,24,40,0.03)]"
          style={{ left: `${percent}%` }}
        >
          <span className="flex items-center gap-1 rounded-[8px] bg-brand px-2.5 py-2">
            <Icon
              name="star"
              size={13}
              style={{ height: 12.45 }}
              className="text-white"
            />
            <span className="font-display text-[15px] font-bold text-white">
              {value}+
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
          max={maxStars}
          step={1}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label="Minimum property rating"
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </div>
    </div>
  );
}
