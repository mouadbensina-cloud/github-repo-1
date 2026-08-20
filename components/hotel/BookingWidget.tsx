"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import {
  DateRangePicker,
  formatRangeLabel,
  type DateRange,
} from "@/components/hero/DateRangePicker";
import { FieldDropdownPortal } from "@/components/hero/FieldDropdownPortal";
import {
  DEFAULT_ROOMS,
  WhoDropdown,
  guestsLabelFor,
  roomsAreComplete,
  toGuestRooms,
  type DraftRoom,
} from "@/components/hero/WhoDropdown";
import { ROOMS_SECTION_ID } from "./RoomOffers";
import type { GuestRoom } from "@/lib/search-params";
import {
  decodeOccupancy,
  encodeOccupancy,
  fromISODate,
  toISODate,
} from "@/lib/search-params";

export type WidgetField = "when" | "who";

/**
 * The sticky booking panel.
 *
 * PRICE LABEL — the design reads "From $X per person" while the room cards
 * below show a stay TOTAL, which would have had the headline and the cards
 * disagreeing on what the same number means. Resolved (with the user) in
 * favour of the total: this shows the cheapest offer's full stay price and is
 * labelled to match, so clicking through to a card shows the identical
 * figure. See the rates route, which returns exactly that as `cheapest`.
 *
 * WHERE — display-only, unlike When and Who. A hotel page is about one hotel
 * in one city, so "editing" the destination here can only mean abandoning
 * this page for a different search — which is precisely what the collapsed
 * search bar pinned at the top of the viewport already does, with real
 * autocomplete. Duplicating that here would put two destination inputs on
 * screen, the nearer one silently navigating away. It stays rendered and
 * prefilled because it is genuine context for the dates beneath it.
 *
 * The date and guest pickers are the SAME components the hero search uses,
 * portalled the same way — not reimplementations, so the two stay in step.
 */
export function BookingWidget({
  cheapestPrice,
  ratesLoading,
  placeLabel,
  checkin,
  checkout,
  rooms,
  onApply,
  openField,
  onOpenField,
}: {
  /** null while loading, unavailable, or when there are no dates yet. */
  cheapestPrice: string | null;
  ratesLoading: boolean;
  placeLabel: string;
  checkin?: string;
  checkout?: string;
  rooms: GuestRoom[];
  /** Commits a new stay: the page pushes it to the URL and refetches. */
  onApply: (next: { checkin: string; checkout: string; rooms: GuestRoom[] }) => void;
  /** Controlled by the page so the rooms section's "Choose dates" button can
   * open this panel's date picker from across the layout. */
  openField: WidgetField | null;
  onOpenField: (field: WidgetField | null) => void;
}) {
  const anchorRef = useRef<HTMLDivElement>(null);

  // Drafts, so an abandoned edit (Cancel, click-away, Escape) leaves the
  // committed URL criteria untouched — same contract as the hero form.
  const [draftRange, setDraftRange] = useState<DateRange>({ start: null, end: null });
  const [draftRooms, setDraftRooms] = useState<DraftRoom[]>([]);

  const committedRange: DateRange = {
    start: checkin ? fromISODate(checkin) : null,
    end: checkout ? fromISODate(checkout) : null,
  };

  /**
   * Re-seed the drafts from the committed values each time a picker opens, so
   * it always starts from what the page is actually showing rather than from
   * a stale edit.
   *
   * Every dependency here is a PRIMITIVE, and that is load-bearing rather
   * than tidiness. Depending on the `rooms` array directly made this effect
   * re-run on every parent render (the page passes `stay?.rooms ?? []`, a
   * fresh array each time), which reset the draft the instant a date was
   * clicked — the click registered, state updated, the re-render wiped it,
   * and the calendar appeared not to respond at all. Keying on the encoded
   * occupancy string instead means it re-runs only when the value genuinely
   * differs.
   */
  const roomsKey = encodeOccupancy(rooms);
  useEffect(() => {
    if (openField === "when") {
      setDraftRange({
        start: checkin ? fromISODate(checkin) : null,
        end: checkout ? fromISODate(checkout) : null,
      });
    }
    if (openField === "who") {
      setDraftRooms(
        (decodeOccupancy(roomsKey) ?? []).map((room) => ({
          adults: room.adults,
          childAges: [...room.childAges],
        })),
      );
    }
  }, [openField, checkin, checkout, roomsKey]);

  const commit = (next: {
    range?: DateRange;
    rooms?: DraftRoom[];
  }) => {
    const range = next.range ?? committedRange;
    const chosen = next.rooms ? toGuestRooms(next.rooms) : rooms;
    if (!range.start || !range.end) return;

    // Setting dates on a link that carried no guests at all would otherwise
    // encode `occupancy=` — an empty value the parser has to paper over on
    // every subsequent read. Committing the site-wide default instead keeps
    // the URL self-describing and matches what the search form would have
    // sent for the same stay.
    const guestRooms = chosen.length ? chosen : toGuestRooms(DEFAULT_ROOMS);

    onApply({
      checkin: toISODate(range.start),
      checkout: toISODate(range.end),
      rooms: guestRooms,
    });
    onOpenField(null);
  };

  const dateLabel = formatRangeLabel(committedRange);
  const guestsLabel = rooms.length
    ? guestsLabelFor(rooms.map((r) => ({ adults: r.adults, childAges: r.childAges })))
    : "";

  return (
    <div
      ref={anchorRef}
      className="flex flex-col gap-4 rounded-[20px] border border-neutral-200 bg-white p-5 shadow-[0px_15px_20px_0px_rgba(0,0,0,0.03)]"
    >
      <div className="flex flex-col gap-1">
        <span className="text-[12px] text-neutral-500">From</span>
        <div className="flex items-end gap-2">
          {ratesLoading ? (
            <span className="h-6 w-24 animate-pulse rounded bg-neutral-100" />
          ) : cheapestPrice ? (
            <>
              <span className="font-display text-[24px] leading-6 font-bold text-neutral-900">
                {cheapestPrice}
              </span>
              <span className="text-[12px] text-neutral-500">total for your stay</span>
            </>
          ) : (
            <span className="text-[14px] text-neutral-500">
              {checkin && checkout ? "No rooms available" : "Add dates for prices"}
            </span>
          )}
        </div>
      </div>

      <Field label="Where" value={placeLabel || "—"} />

      <Field
        label="When"
        value={dateLabel || "Add dates"}
        muted={!dateLabel}
        onClick={() => onOpenField(openField === "when" ? null : "when")}
        active={openField === "when"}
      />

      <Field
        label="Who"
        value={guestsLabel || "Add guests"}
        muted={!guestsLabel}
        onClick={() => onOpenField(openField === "who" ? null : "who")}
        active={openField === "who"}
        trailing={<Icon name="chevron-down" size={24} className="text-neutral-500" />}
      />

      <button
        type="button"
        onClick={() => {
          document
            .getElementById(ROOMS_SECTION_ID)
            ?.scrollIntoView({ behavior: "smooth", block: "start" });
        }}
        className="flex h-10 w-full cursor-pointer items-center justify-center rounded-lg bg-brand px-4 font-display text-[16px] tracking-[-0.16px] text-white transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none"
      >
        Choose room
      </button>

      {openField ? (
        <FieldDropdownPortal
          anchorRef={anchorRef}
          align="right"
          onClose={() => onOpenField(null)}
        >
          {openField === "when" ? (
            <DateRangePicker
              range={draftRange}
              onChange={setDraftRange}
              onCancel={() => onOpenField(null)}
              onApply={() => commit({ range: draftRange })}
            />
          ) : (
            <WhoDropdown
              rooms={draftRooms}
              onChange={setDraftRooms}
              onApply={() => {
                if (roomsAreComplete(draftRooms)) commit({ rooms: draftRooms });
              }}
            />
          )}
        </FieldDropdownPortal>
      ) : null}
    </div>
  );
}

function Field({
  label,
  value,
  muted,
  onClick,
  active,
  trailing,
}: {
  label: string;
  value: string;
  muted?: boolean;
  onClick?: () => void;
  active?: boolean;
  trailing?: React.ReactNode;
}) {
  const body = (
    <>
      <span className="flex min-w-0 flex-1 flex-col gap-1 text-left">
        <span className="text-[12px] tracking-[-0.24px] text-neutral-500">{label}</span>
        <span
          className={`truncate text-[14px] tracking-[-0.28px] ${
            muted ? "text-neutral-400" : "text-[#0d121c]"
          }`}
        >
          {value}
        </span>
      </span>
      {trailing}
    </>
  );

  const shell = `flex min-h-[53px] w-full items-center gap-2 rounded-lg border bg-white px-4 py-2 ${
    active ? "border-brand" : "border-neutral-200"
  }`;

  // Non-interactive fields stay <div>s rather than disabled buttons: a
  // disabled control in the tab order announces itself as broken, whereas
  // this is simply context, not an input.
  if (!onClick) return <div className={shell}>{body}</div>;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`${shell} cursor-pointer text-left transition-colors hover:border-neutral-400 focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none`}
    >
      {body}
    </button>
  );
}
