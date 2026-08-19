"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/Icon";

export type DateRange = { start: Date | null; end: Date | null };

const WEEKDAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, count: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + count, 1);
}

function isSameDay(a: Date | null, b: Date | null): boolean {
  return !!a && !!b && a.getTime() === b.getTime();
}

function formatMonthLabel(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export function formatRangeLabel(range: DateRange): string {
  if (!range.start) return "";
  const startLabel = range.start.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  if (!range.end) return startLabel;
  const sameMonth = range.start.getMonth() === range.end.getMonth();
  const endLabel = range.end.toLocaleDateString(
    "en-US",
    sameMonth ? { day: "numeric" } : { month: "short", day: "numeric" },
  );
  return `${startLabel} - ${endLabel}`;
}

/** Monday-first grid padded with the adjacent months' days needed to fill
 * whole weeks — rendered muted, matching Figma's greyed-out padding days. */
function buildMonthGrid(month: Date): Date[] {
  const first = startOfMonth(month);
  const firstWeekday = (first.getDay() + 6) % 7; // Monday = 0
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - firstWeekday);

  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const day = new Date(gridStart);
    day.setDate(gridStart.getDate() + i);
    days.push(day);
  }
  return days;
}

/**
 * The When field's date picker (Figma 33214:31532) — two months side by
 * side, always starting from the real current month (never earlier — the
 * left month's back arrow just disappears once you're there), with past
 * dates disabled. Cancel/Apply here means this component stays a pure
 * controlled view: SearchPanel owns the distinction between the applied
 * range and this in-progress draft, resetting the draft to the applied
 * value on Cancel rather than this component tracking that itself.
 */
export function DateRangePicker({
  range,
  onChange,
  onCancel,
  onApply,
}: {
  range: DateRange;
  onChange: (range: DateRange) => void;
  onCancel: () => void;
  onApply: () => void;
}) {
  const today = startOfDay(new Date());
  const [leftMonth, setLeftMonth] = useState(
    startOfMonth(range.start ?? today),
  );
  const canGoBack = leftMonth.getTime() > startOfMonth(today).getTime();

  /**
   * Three rules, in the order they can apply:
   *   - past dates are inert (they also render disabled)
   *   - with no range in progress, or a complete one, a click starts fresh.
   *     Starting fresh CLEARS any existing check-out rather than keeping one
   *     that may now precede the new check-in — the alternative, silently
   *     shifting the end date to stay valid, changes a date the user chose
   *     without saying so.
   *   - completing a range requires a strictly later day, so a second click
   *     on the start date restarts instead of booking a zero-night stay.
   */
  const handleSelect = (day: Date) => {
    if (day < today) return;
    if (!range.start || range.end || day <= range.start) {
      onChange({ start: day, end: null });
    } else {
      onChange({ start: range.start, end: day });
    }
  };

  return (
    <div className="flex w-fit flex-col items-start">
      <div className="flex items-start">
        <MonthGrid
          month={leftMonth}
          today={today}
          range={range}
          onSelect={handleSelect}
          onPrev={canGoBack ? () => setLeftMonth(addMonths(leftMonth, -1)) : undefined}
        />
        <span className="w-px self-stretch bg-neutral-200" />
        <MonthGrid
          month={addMonths(leftMonth, 1)}
          today={today}
          range={range}
          onSelect={handleSelect}
          onNext={() => setLeftMonth(addMonths(leftMonth, 1))}
        />
      </div>
      <div className="flex w-full items-center justify-end gap-3 border-t border-neutral-200 px-6 py-4">
        <button
          type="button"
          onClick={onCancel}
          className="cursor-pointer rounded-[8px] border border-neutral-200 px-5 py-2.5 font-display text-[14px] font-medium text-neutral-900 transition-colors hover:bg-surface"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onApply}
          disabled={!range.start || !range.end}
          className="cursor-pointer rounded-[8px] bg-brand px-5 py-2.5 font-display text-[14px] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Apply
        </button>
      </div>
    </div>
  );
}

function MonthGrid({
  month,
  today,
  range,
  onSelect,
  onPrev,
  onNext,
}: {
  month: Date;
  today: Date;
  range: DateRange;
  onSelect: (day: Date) => void;
  onPrev?: () => void;
  onNext?: () => void;
}) {
  const days = buildMonthGrid(month);

  return (
    <div className="flex w-[336px] flex-col gap-4 p-6">
      <div className="flex w-full items-center justify-between">
        <button
          type="button"
          onClick={onPrev}
          disabled={!onPrev}
          aria-label="Previous month"
          className={`flex size-7 items-center justify-center rounded-full border border-neutral-200 text-neutral-900 transition-colors ${
            onPrev ? "cursor-pointer hover:bg-surface" : "invisible"
          }`}
        >
          <Icon name="chevron" size={10} style={{ rotate: "90deg" }} />
        </button>
        <p className="font-display text-[14px] font-bold text-neutral-900">
          {formatMonthLabel(month)}
        </p>
        <button
          type="button"
          onClick={onNext}
          disabled={!onNext}
          aria-label="Next month"
          className={`flex size-7 items-center justify-center rounded-full border border-neutral-200 text-neutral-900 transition-colors ${
            onNext ? "cursor-pointer hover:bg-surface" : "invisible"
          }`}
        >
          <Icon name="chevron" size={10} style={{ rotate: "-90deg" }} />
        </button>
      </div>

      <div className="grid grid-cols-7">
        {WEEKDAY_LABELS.map((label, i) => (
          <span
            key={i}
            className="flex h-8 items-center justify-center font-display text-[12px] font-medium text-neutral-500"
          >
            {label}
          </span>
        ))}
        {days.map((day) => {
          const inMonth = day.getMonth() === month.getMonth();
          const isPast = day < today;
          const isStart = isSameDay(day, range.start);
          const isEnd = isSameDay(day, range.end);
          const inRange =
            !!range.start && !!range.end && day > range.start && day < range.end;

          return (
            <button
              key={day.toISOString()}
              type="button"
              disabled={isPast}
              onClick={() => onSelect(day)}
              className={`flex h-9 items-center justify-center font-display text-[14px] transition-colors ${
                isStart || isEnd
                  ? "rounded-full bg-brand font-medium text-white"
                  : inRange
                    ? "bg-brand/10 text-brand"
                    : isPast || !inMonth
                      ? "cursor-not-allowed text-neutral-300"
                      : "cursor-pointer rounded-full text-neutral-900 hover:bg-surface"
              }`}
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
