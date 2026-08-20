"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { imageStyle } from "@/components/ui/placeholder";
import { SectionTitle } from "./HotelOverview";
import { RoomDetailModal } from "./RoomDetailModal";
import type { RoomBadge, RoomOffer } from "@/lib/hotel-data";

/** The anchor the booking widget's "Choose room" button scrolls to. */
export const ROOMS_SECTION_ID = "choose-your-room";

/** How many cards show before "More rooms" is needed — and, shared with
 * RoomDetailModal, how many tiles the room-switcher strip caps itself to.
 * Local to the UI, not the API: the route returns the hotel's full
 * (deduplicated, image-guaranteed) offer set, and this is purely how much of
 * it a first glance — on the page or inside the modal — shows at once. */
export const VISIBLE_OFFER_COUNT = 4;

export type RoomsState =
  /** No dates in the URL yet — nothing has been requested, and won't be. */
  | { status: "incomplete" }
  /** Dates present but unusable (hand-edited link). */
  | { status: "invalid"; title: string; body: string }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; offers: RoomOffer[] };

function Badge({ badge }: { badge: RoomBadge }) {
  return (
    <span
      className={`flex items-center gap-[6px] text-[12px] ${
        badge.tone === "positive" ? "text-[#15a233]" : "text-neutral-500"
      }`}
    >
      <Icon name={badge.icon} size={16} className="shrink-0" />
      {badge.label}
    </span>
  );
}

function Divider() {
  return <span aria-hidden className="h-3 w-px shrink-0 bg-neutral-300" />;
}

/**
 * One bookable offer.
 *
 * The whole card is the click target rather than a separate "Select" button:
 * the design has no such button, and inventing one would put a control on
 * screen that isn't in the spec. Wrapping the card in a real <button> keeps
 * it keyboard-reachable and focus-ringed, which a clickable <div> would not
 * — it just has no handler yet.
 *
 * Size and sleeps each disappear independently when the API didn't supply
 * them, along with the divider between them, so a card never shows "0 m²"
 * or a dangling separator.
 */
function RoomOfferCard({
  offer,
  onOpen,
}: {
  offer: RoomOffer;
  onOpen: () => void;
}) {
  const hasSize = Boolean(offer.sizeLabel);
  const hasSleeps = typeof offer.sleeps === "number" && offer.sleeps > 0;

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-haspopup="dialog"
      aria-label={`View ${offer.name}, ${offer.price}`}
      className="flex w-full cursor-pointer items-center gap-6 rounded-[24px] bg-white p-[6px] text-left drop-shadow-[0px_4px_10px_rgba(0,0,0,0.09)] transition-transform hover:-translate-y-px focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none"
    >
      <span
        className="h-[159px] w-[254px] shrink-0 rounded-[18px] bg-cover bg-center"
        style={imageStyle(offer.image, offer.id)}
        role="img"
        aria-label={offer.name}
      />

      <span className="flex min-w-0 flex-1 flex-col gap-[10px] py-2 pr-4">
        <span className="font-display text-[16px] font-bold break-words text-neutral-900">
          {offer.name}
        </span>

        {hasSize || hasSleeps ? (
          <span className="flex items-center gap-2 text-[14px] text-[#384250]">
            {hasSize ? (
              <span className="flex items-center gap-[6px]">
                <Icon name="square-scale" size={16} className="shrink-0" />
                {offer.sizeLabel}
              </span>
            ) : null}
            {hasSize && hasSleeps ? <Divider /> : null}
            {hasSleeps ? (
              <span className="flex items-center gap-[6px]">
                <Icon name="users" size={16} className="shrink-0" />
                Sleeps {offer.sleeps}
              </span>
            ) : null}
          </span>
        ) : null}

        <span className="flex flex-wrap items-center gap-2">
          {/* Omitted entirely when the API stated no cancellation policy —
              defaulting to either answer would be a claim about money. */}
          {offer.cancellation ? <Badge badge={offer.cancellation} /> : null}
          {offer.cancellation ? <Divider /> : null}
          <Badge badge={offer.meals} />
        </span>

        <span className="flex flex-wrap items-baseline gap-2">
          <span className="font-display text-[24px] font-bold text-neutral-900">
            {offer.price}
          </span>
          {/* Only present on a genuine promotional rate. */}
          {offer.originalPrice ? (
            <span className="text-[18px] text-neutral-500 line-through">
              {offer.originalPrice}
            </span>
          ) : null}
          <span className="text-[12px] text-neutral-500">{offer.priceNote}</span>
        </span>
      </span>
    </button>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-[24px] border border-neutral-200 bg-white p-6">
      {children}
    </div>
  );
}

function Title({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-display text-[16px] font-semibold text-neutral-900">{children}</p>
  );
}

function Body({ children }: { children: React.ReactNode }) {
  return <p className="text-[14px] text-neutral-500">{children}</p>;
}

/**
 * The rooms section and every state it can be in.
 *
 * Scoped on purpose: each of these renders INSIDE the section, leaving the
 * rest of the page — name, photos, facilities, description — fully intact.
 * Pricing is the only thing that can be missing here, so it's the only thing
 * that degrades.
 */
export function RoomOffersSection({
  state,
  onRetry,
  onPickDates,
}: {
  state: RoomsState;
  onRetry: () => void;
  /** Opens the booking widget's date picker — the fix for both the
   * "no dates yet" and "bad dates" states is the same control. */
  onPickDates: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  // Collapses back whenever a new request starts (dates changed, a retry) —
  // the page's rates effect always passes through "loading" before it
  // resolves, so this is the one signal that reliably fires on every
  // refetch without the section needing to compare offer arrays itself.
  // Otherwise "More rooms" clicked on a 20-offer search would stay expanded
  // after new dates cut it down to 3.
  useEffect(() => {
    if (state.status === "loading") setExpanded(false);
  }, [state.status]);

  const offers = state.status === "ready" ? state.offers : [];
  const visibleOffers = expanded ? offers : offers.slice(0, VISIBLE_OFFER_COUNT);
  const hiddenCount = offers.length - visibleOffers.length;

  /**
   * Which offer the detail modal is showing, by id rather than by object.
   * Ids survive a refetch that produces an equal-but-not-identical offer;
   * a held object reference would leave the modal rendering stale prices
   * from the previous search. Resolving it back on every render also means
   * a refetch that drops the open offer entirely closes the modal on its
   * own, instead of stranding it on an offer no longer for sale.
   */
  const [openOfferId, setOpenOfferId] = useState<string | null>(null);
  const openOffer = offers.find((offer) => offer.id === openOfferId) ?? null;

  /**
   * The switcher strip's own tiles — capped to VISIBLE_OFFER_COUNT, same as
   * the page's default view, rather than every offer the hotel has.
   *
   * Just slicing the first four would leave the strip showing no highlighted
   * tile at all when the open offer was reached via "More rooms" (so it
   * isn't among them) — a switcher with nothing selected reads as broken,
   * not as "there are more than four." Swapping the open offer into the last
   * slot when that happens keeps the cap at exactly four while guaranteeing
   * whatever's open is always represented in its own strip.
   */
  const modalOffers = (() => {
    const capped = offers.slice(0, VISIBLE_OFFER_COUNT);
    if (openOffer && !capped.some((offer) => offer.id === openOffer.id)) {
      return [...capped.slice(0, VISIBLE_OFFER_COUNT - 1), openOffer];
    }
    return capped;
  })();

  return (
    <section id={ROOMS_SECTION_ID} className="flex scroll-mt-[140px] flex-col gap-4">
      <SectionTitle>Choose your room</SectionTitle>

      {state.status === "incomplete" ? (
        <Panel>
          <Title>Add your dates to see rooms</Title>
          <Body>
            This link doesn&apos;t include a check-in and check-out date, so we
            can&apos;t show live prices yet. Pick your dates to see what&apos;s
            available.
          </Body>
          <PickDatesButton onClick={onPickDates} />
        </Panel>
      ) : null}

      {state.status === "invalid" ? (
        <Panel>
          <Title>{state.title}</Title>
          <Body>{state.body}</Body>
          <PickDatesButton onClick={onPickDates} />
        </Panel>
      ) : null}

      {state.status === "loading" ? <RoomsSkeleton /> : null}

      {state.status === "error" ? (
        <div className="flex flex-col items-start gap-3 rounded-[24px] border border-red-200 bg-red-50 p-6">
          <p className="font-display text-[16px] font-semibold text-red-900">
            We couldn&apos;t load rooms
          </p>
          <p className="text-[14px] text-red-800">{state.message}</p>
          <button
            type="button"
            onClick={onRetry}
            className="cursor-pointer rounded-lg border border-red-300 bg-white px-4 py-2 font-display text-[13px] font-medium text-red-900 transition-colors hover:bg-red-100"
          >
            Try again
          </button>
        </div>
      ) : null}

      {state.status === "ready" && offers.length === 0 ? (
        <Panel>
          <Title>No availability for these dates</Title>
          <Body>
            This hotel has no bookable rooms for the dates and guests you chose.
            Try different dates, or fewer guests per room.
          </Body>
          <PickDatesButton onClick={onPickDates} label="Change dates" />
        </Panel>
      ) : null}

      {state.status === "ready" && offers.length > 0 ? (
        <div className="flex flex-col gap-5 rounded-[24px] bg-surface p-5">
          {visibleOffers.map((offer) => (
            <RoomOfferCard
              key={offer.id}
              offer={offer}
              onOpen={() => setOpenOfferId(offer.id)}
            />
          ))}

          {hiddenCount > 0 ? (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="w-fit cursor-pointer self-center rounded-lg border border-neutral-200 bg-white px-4 py-2 font-display text-[13px] font-medium text-neutral-900 transition-colors hover:bg-surface focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none"
            >
              More rooms ({hiddenCount})
            </button>
          ) : null}
        </div>
      ) : null}

      {openOffer ? (
        <RoomDetailModal
          offers={modalOffers}
          selected={openOffer}
          onSelect={(offer) => setOpenOfferId(offer.id)}
          onClose={() => setOpenOfferId(null)}
        />
      ) : null}
    </section>
  );
}

function PickDatesButton({
  onClick,
  label = "Choose dates",
}: {
  onClick: () => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-2 cursor-pointer rounded-lg bg-brand px-4 py-2 font-display text-[13px] font-medium text-white transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none"
    >
      {label}
    </button>
  );
}

function RoomsSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-label="Loading rooms" aria-busy>
      {[0, 1, 2].map((index) => (
        <div
          key={index}
          className="flex animate-pulse items-center gap-6 rounded-[24px] bg-white p-[6px] drop-shadow-[0px_4px_10px_rgba(0,0,0,0.09)]"
        >
          <div className="h-[159px] w-[254px] shrink-0 rounded-[18px] bg-neutral-100" />
          <div className="flex flex-1 flex-col gap-3 py-2">
            <div className="h-5 w-1/2 rounded bg-neutral-100" />
            <div className="h-4 w-1/3 rounded bg-neutral-100" />
            <div className="h-4 w-2/5 rounded bg-neutral-100" />
            <div className="h-7 w-1/4 rounded bg-neutral-100" />
          </div>
        </div>
      ))}
    </div>
  );
}
