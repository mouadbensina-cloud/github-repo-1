"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Icon, type IconName } from "@/components/ui/Icon";
import { imageStyle } from "@/components/ui/placeholder";
import type { RoomOffer } from "@/lib/hotel-data";

/**
 * The room-detail modal (Figma 33376:247118).
 *
 * Two floating pieces, not one: a room SWITCHER strip sits above the card as
 * its own rounded white pill, and the card itself below it. They're separate
 * frames in the design and separate elements here, sharing only the centred
 * column and a 16px gap.
 *
 * The switcher's tiles are real offers, not a separate summary of them, so
 * clicking one swaps every part of the card (photos, amenities, description,
 * price). Selection lives in the PARENT, so the modal has no idea which
 * offer is "current"; it just renders the one it is handed. That keeps
 * "which card did I click" and "which tile is highlighted" the same single
 * piece of state instead of two that can drift.
 *
 * `offers` is NOT the hotel's full list — this component just renders
 * whatever it's given. The caller (RoomOffersSection) caps it to
 * VISIBLE_OFFER_COUNT before passing it down, same limit the page's default
 * view uses, so the strip never grows past the four the design fits; see
 * that caller for how it keeps the open offer represented even when it was
 * reached through "More rooms."
 */
export function RoomDetailModal({
  offers,
  selected,
  onSelect,
  onClose,
}: {
  /** Already capped by the caller — see the component doc comment. */
  offers: RoomOffer[];
  selected: RoomOffer;
  onSelect: (offer: RoomOffer) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  // Same lock the hero's own search modal takes — there is nothing behind
  // this worth scrolling to while it's open.
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const [hero, ...rest] = selected.images;
  const thumbs = rest.slice(0, 3);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-auto bg-black/10 p-6 backdrop-blur-[10px]"
      // Click-away closes, but only on the backdrop itself — a click that
      // started inside the card and drifted out (a text selection drag)
      // must not count, hence checking the target rather than using a
      // bubbling handler on a wrapper.
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex flex-col items-center gap-4">
        {offers.length > 1 ? (
          <div
            role="tablist"
            aria-label="Room options"
            className="flex max-w-full gap-4 overflow-x-auto rounded-[24px] bg-white p-4 shadow-[0px_16px_32px_-12px_rgba(16,24,40,0.14)]"
          >
            {offers.map((offer) => {
              const isSelected = offer.id === selected.id;
              return (
                <button
                  key={offer.id}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  aria-label={`${offer.name}, ${offer.price}`}
                  onClick={() => onSelect(offer)}
                  // The selected tile is a white 3px inset border with a
                  // brand ring OUTSIDE it — drawn as a ring rather than a
                  // border so it doesn't change the tile's 60px box and
                  // nudge its neighbours when selection moves.
                  className={`size-[60px] shrink-0 cursor-pointer bg-cover bg-center transition-shadow ${
                    isSelected
                      ? "rounded-[12px] border-[3px] border-white shadow-[0px_0px_0px_4px_var(--color-brand)]"
                      : "rounded-[16px] hover:opacity-80"
                  }`}
                  style={imageStyle(offer.images[0], offer.id)}
                />
              );
            })}
          </div>
        ) : null}

        <div className="flex h-[577px] w-[880px] max-w-full gap-6 rounded-[32px] bg-white p-8 shadow-[0px_24px_48px_-12px_rgba(16,24,40,0.18)]">
          <div className="flex w-[396px] shrink-0 flex-col gap-[30px]">
            <button
              type="button"
              onClick={onClose}
              className="flex w-fit cursor-pointer items-center gap-3 transition-opacity hover:opacity-70"
            >
              <span className="flex size-8 items-center justify-center rounded-full border border-neutral-200 bg-white">
                <Icon
                  name="chevron-down"
                  size={22}
                  style={{ transform: "rotate(-90deg) scaleY(-1)" }}
                />
              </span>
              <span className="font-display text-[16px] font-medium tracking-[-0.32px] text-[#4d5761]">
                Back
              </span>
            </button>

            {/* Figma clips this region (the description overruns its box).
                Scrolling rather than hard-clipping keeps the identical fixed
                height and cut-off point while leaving the rest of the text
                actually reachable. */}
            <div className="flex min-h-px flex-1 flex-col gap-5 overflow-y-auto">
              <div className="flex flex-col gap-4">
                <h2 className="font-display text-[20px] font-bold tracking-[-0.2px] text-neutral-900">
                  {selected.name}
                </h2>

                {selected.sizeLabel || selected.sleeps ? (
                  <div className="flex items-center gap-10">
                    {selected.sizeLabel ? (
                      <span className="flex items-center gap-[6px] text-[14px] text-neutral-800">
                        <Icon name="square-scale" size={20} className="shrink-0" />
                        {selected.sizeLabel}
                      </span>
                    ) : null}
                    {selected.sleeps ? (
                      <span className="flex items-center gap-[6px] text-[14px] text-neutral-800">
                        <Icon name="users" size={20} className="shrink-0" />
                        Sleeps {selected.sleeps}
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>

              {/* Each block drops its own leading divider with it, so an
                  offer with no matched static room (no amenities, no
                  description) never leaves a stray rule behind. */}
              {selected.amenities.length > 0 ? (
                <>
                  <Divider />
                  <div className="flex flex-col gap-5">
                    <div className="flex items-center justify-between gap-4">
                      <h3 className="font-display text-[18px] font-bold tracking-[-0.18px] text-neutral-800">
                        Room amenities
                      </h3>
                      <button
                        type="button"
                        className="shrink-0 cursor-pointer font-display text-[14px] font-medium tracking-[-0.112px] text-[#0d121c] underline underline-offset-2 focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none"
                      >
                        See all amenities
                      </button>
                    </div>

                    <ul className="flex flex-wrap items-center gap-5">
                      {selected.amenities.map((amenity) => (
                        <li
                          key={amenity.label}
                          className="flex items-center gap-[6px] text-[14px] tracking-[-0.14px] text-[#384250]"
                        >
                          <Icon
                            name={amenity.icon as IconName}
                            size={16}
                            className="shrink-0"
                          />
                          {amenity.label}
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              ) : null}

              {selected.description ? (
                <>
                  <Divider />
                  <div className="flex flex-col gap-[10px]">
                    <h3 className="font-display text-[18px] font-bold tracking-[-0.18px] text-neutral-800">
                      Room description
                    </h3>
                    <p className="text-[16px] leading-[26px] text-[#4d5761]">
                      {selected.description}
                    </p>
                  </div>
                </>
              ) : null}
            </div>

            <div className="flex items-end justify-between gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-[12px] text-neutral-500">From</span>
                <div className="flex items-end gap-2">
                  <span className="font-display text-[24px] leading-6 font-bold text-neutral-900">
                    {selected.price}
                  </span>
                  {/* "Per person" in the design, but this is the same stay
                      TOTAL the card behind it shows — matching the booking
                      widget's already-resolved wording rather than
                      relabelling one number two different ways. */}
                  <span className="text-[12px] text-neutral-500">
                    total for your stay
                  </span>
                </div>
              </div>

              <button
                type="button"
                className="flex h-10 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-brand px-4 font-display text-[16px] tracking-[-0.16px] text-white transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none"
              >
                Choose room
              </button>
            </div>
          </div>

          <div className="flex w-[396px] shrink-0 flex-col gap-1 overflow-hidden rounded-[24px]">
            <div
              className="min-h-px flex-1 rounded-[8px] bg-cover bg-center"
              style={imageStyle(hero, selected.id)}
              role="img"
              aria-label={selected.name}
            />
            {thumbs.length > 0 ? (
              <div className="flex min-h-px flex-1 gap-1">
                <div
                  className="min-w-px flex-1 rounded-[8px] bg-cover bg-center"
                  style={imageStyle(thumbs[0], `${selected.id}-0`)}
                  role="img"
                  aria-label={selected.name}
                />
                {thumbs.length > 1 ? (
                  <div className="flex min-w-px flex-1 flex-col gap-1">
                    {thumbs.slice(1).map((image, index) => (
                      <div
                        key={`${image}-${index}`}
                        className="min-h-px flex-1 rounded-[8px] bg-cover bg-center"
                        style={imageStyle(image, `${selected.id}-${index + 1}`)}
                        role="img"
                        aria-label={selected.name}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Divider() {
  return <hr className="border-[#eaecf0]" />;
}
