"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { imageStyle } from "@/components/ui/placeholder";
import type { Hotel } from "@/lib/search-data";

export function HotelCard({
  hotel,
  onShowOnMap,
  onHoverChange,
  imageFetchDelayMs = 0,
}: {
  hotel: Hotel;
  onShowOnMap?: (id: string) => void;
  /** Lets the map highlight this hotel's pin while its card is hovered,
   * without selecting it (no flyTo, no popup) — that stays a click/"Show on
   * map" thing. */
  onHoverChange?: (hovering: boolean) => void;
  /** Staggers this card's gallery fetch relative to sibling cards mounting
   * in the same batch — the sandbox key's rate limit is tight enough that
   * a page of cards all firing their own image fetch in the same instant
   * risks 429s; SearchPage passes each card a small multiple of its index
   * so a batch lands as a burst spread over ~1-2s instead. */
  imageFetchDelayMs?: number;
}) {
  const {
    id,
    name,
    image,
    stars,
    ratingLabel,
    reviewCount,
    score,
    address,
    distance,
    roomType,
    bedInfo,
    breakfastIncluded,
    freeCancellation,
    stayInfo,
    price,
    priceNote,
  } = hotel;

  // hotel.image (the search response's single main_photo) renders
  // immediately; this gallery fetch fills in the rest of the carousel once
  // it lands, or the card just stays a single (real) photo with no arrows.
  const [gallery, setGallery] = useState<string[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      fetch(`/api/hotels/${id}/images`)
        .then((res) =>
          res.ok ? res.json() : Promise.reject(new Error("images fetch failed")),
        )
        .then((body: { images: string[] }) => {
          if (!cancelled && body.images?.length) setGallery(body.images);
        })
        .catch(() => {
          // No user-facing error for this — the card just keeps its one
          // photo and hides the carousel controls below.
        });
    }, imageFetchDelayMs);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [id, imageFetchDelayMs]);

  const images = gallery.length > 0 ? gallery : image ? [image] : [];
  const hasCarousel = images.length > 1;
  const activeImage = images[activeIndex] ?? image;

  const goToPrevious = () =>
    setActiveIndex((i) => (i - 1 + images.length) % images.length);
  const goToNext = () => setActiveIndex((i) => (i + 1) % images.length);

  // Real galleries run up to ~27 photos — capped at 5 dots (matching the
  // original design) standing in as a proportional progress indicator
  // rather than one dot per photo.
  const dotCount = Math.min(images.length, 5);
  const activeDot =
    dotCount > 1
      ? Math.round((activeIndex / (images.length - 1)) * (dotCount - 1))
      : 0;

  return (
    <article
      onMouseEnter={() => onHoverChange?.(true)}
      onMouseLeave={() => onHoverChange?.(false)}
      className="flex w-full items-start rounded-[24px] border border-neutral-200 bg-white"
    >
      <div className="flex w-[221px] shrink-0 self-stretch p-1">
        <div
          className="relative flex w-full flex-1 flex-col items-end justify-between rounded-[20px] bg-cover bg-center transition-[background-image] p-[10px]"
          style={imageStyle(activeImage, id)}
        >
          <div className="absolute inset-0 rounded-[20px] bg-gradient-to-b from-transparent to-black/30" />

          <button
            type="button"
            aria-label={`Save ${name}`}
            className="relative flex size-[30px] shrink-0 cursor-pointer items-center justify-center rounded-full border border-white/35 bg-black/30 text-white backdrop-blur-[4.5px] transition-colors hover:bg-black/45"
          >
            <Icon name="heart" size={14} style={{ height: 12.4 }} />
          </button>

          {hasCarousel ? (
            <div className="relative flex w-full items-center justify-center gap-1">
              {Array.from({ length: dotCount }).map((_, i) => (
                <span
                  key={i}
                  className={`size-[6px] shrink-0 rounded-full ${i === activeDot ? "bg-white" : "bg-white/60"}`}
                />
              ))}
            </div>
          ) : null}

          {hasCarousel ? (
            <>
              <button
                type="button"
                onClick={goToPrevious}
                aria-label="Previous photo"
                className="absolute top-1/2 left-[10px] flex size-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-white/80 text-neutral-900 backdrop-blur-sm transition-colors hover:bg-white"
              >
                <Icon name="chevron" size={10} style={{ rotate: "90deg" }} />
              </button>
              <button
                type="button"
                onClick={goToNext}
                aria-label="Next photo"
                className="absolute top-1/2 right-[10px] flex size-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-white/80 text-neutral-900 backdrop-blur-sm transition-colors hover:bg-white"
              >
                <Icon name="chevron" size={10} style={{ rotate: "-90deg" }} />
              </button>
            </>
          ) : null}
        </div>
      </div>

      <div className="flex min-w-0 flex-1 items-start justify-center py-4 pr-4 pl-3">
        <div className="flex min-w-0 flex-1 flex-col items-start gap-2.5">
          <div className="flex w-full flex-col gap-2.5">
            <div className="flex w-full items-start gap-3">
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <div className="flex shrink-0 items-center gap-[3px] text-neutral-900">
                  {Array.from({ length: stars }).map((_, i) => (
                    <Icon
                      key={i}
                      name="star"
                      size={12.4}
                      style={{ height: 11.9 }}
                    />
                  ))}
                </div>
                <h3
                  title={name}
                  className="w-full truncate font-display text-[18px] font-semibold tracking-[-0.18px] text-neutral-900"
                >
                  {name}
                </h3>
              </div>

              <div className="flex shrink-0 items-center gap-3">
                <div className="flex flex-col items-end justify-center whitespace-nowrap">
                  <span className="font-display text-[14px] font-semibold tracking-[-0.14px] text-neutral-800">
                    {ratingLabel}
                  </span>
                  <span className="font-display text-[12px] tracking-[-0.24px] text-neutral-500">
                    {reviewCount}
                  </span>
                </div>
                <span className="flex size-9 shrink-0 items-center justify-center rounded-tl-[10px] rounded-tr-[10px] rounded-br-[2px] rounded-bl-[10px] bg-[#21631a] font-display text-[16px] font-medium text-white">
                  {score}
                </span>
              </div>
            </div>

            <div className="flex w-full flex-col gap-[6px]">
              <div className="flex items-center gap-[6px]">
                <div className="flex items-center gap-1">
                  <Icon name="pin" size={16} />
                  <span className="font-display text-[14px] tracking-[-0.14px] whitespace-nowrap text-[#4d5761]">
                    {address}
                  </span>
                </div>
                <Icon name="dot" size={4} className="shrink-0 text-neutral-400" />
                <button
                  type="button"
                  onClick={() => onShowOnMap?.(id)}
                  className="cursor-pointer font-display text-[14px] font-medium tracking-[-0.14px] whitespace-nowrap text-brand underline"
                >
                  Show on map
                </button>
              </div>
              {distance ? (
                <div className="flex items-center gap-1">
                  <Icon name="walking" size={16} />
                  <span className="font-display text-[14px] tracking-[-0.14px] whitespace-nowrap text-[#4d5761]">
                    {distance}
                  </span>
                </div>
              ) : null}
            </div>
          </div>

          <div
            className={`flex w-full items-start ${roomType || bedInfo || breakfastIncluded || freeCancellation ? "justify-between" : "justify-end"}`}
          >
            {roomType || bedInfo || breakfastIncluded || freeCancellation ? (
              <div className="flex items-center gap-2 pl-[6px]">
                <div className="flex items-start self-stretch">
                  <span className="h-full w-[2px] shrink-0 rounded-[5px] bg-[#f2f3f5]" />
                </div>
                <div className="flex w-[147px] flex-col gap-2">
                  {roomType || bedInfo ? (
                    <div className="flex flex-col gap-[2px] text-neutral-900">
                      {roomType ? (
                        <span className="font-display text-[16px] font-semibold tracking-[-0.16px]">
                          {roomType}
                        </span>
                      ) : null}
                      {bedInfo ? (
                        <span className="font-display text-[14px] tracking-[-0.14px] text-neutral-900">
                          {bedInfo}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                  <div className="flex flex-col gap-1">
                    {breakfastIncluded ? (
                      <span className="flex items-center gap-[6px] text-[#118824]">
                        <Icon name="coffee" size={18} />
                        <span className="font-display text-[14px] font-medium tracking-[-0.14px] whitespace-nowrap">
                          Breakfast included
                        </span>
                      </span>
                    ) : null}
                    {freeCancellation ? (
                      <span className="flex items-center gap-[6px] text-[#118824]">
                        <Icon name="checkmark" size={18} />
                        <span className="font-display text-[14px] font-medium tracking-[-0.14px] whitespace-nowrap">
                          Free Cancellation
                        </span>
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}

            <div className="flex w-[163px] shrink-0 flex-col items-end gap-2.5">
              <div className="flex w-full flex-col items-end gap-1">
                <span className="font-display text-[13px] tracking-[-0.195px] whitespace-nowrap text-[#4d5761]">
                  {stayInfo}
                </span>
                <span className="font-display text-[24px] font-semibold whitespace-nowrap text-neutral-900">
                  {price}
                </span>
                <span className="font-display text-[13px] tracking-[-0.195px] whitespace-nowrap text-[#4d5761]">
                  {priceNote}
                </span>
              </div>
              <button
                type="button"
                className="flex shrink-0 cursor-pointer items-center justify-center gap-1 rounded-[80px] border border-brand bg-brand py-2 pr-[13px] pl-[15px] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] transition-opacity hover:opacity-90"
              >
                <span className="font-display text-[12px] font-semibold tracking-[-0.096px] whitespace-nowrap text-white">
                  See availability
                </span>
                <Icon
                  name="arrow-right"
                  size={20}
                  className="text-white"
                  style={{ rotate: "-90deg" }}
                />
              </button>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
