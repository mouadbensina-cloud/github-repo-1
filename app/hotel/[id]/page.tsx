"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { formatRangeLabel } from "@/components/hero/DateRangePicker";
import { HeroSection } from "@/components/hero/HeroSection";
import { guestsLabelFor } from "@/components/hero/WhoDropdown";
import { Footer } from "@/components/layout/Footer";
import { Container } from "@/components/ui/Container";
import { BookingWidget, type WidgetField } from "@/components/hotel/BookingWidget";
import { HotelGallery } from "@/components/hotel/HotelGallery";
import { HotelHeader } from "@/components/hotel/HotelHeader";
import { PopularFacilities, SmartHighlights } from "@/components/hotel/HotelOverview";
import { PropertyDescription } from "@/components/hotel/PropertyDescription";
import { ReviewHighlights } from "@/components/hotel/ReviewHighlights";
import { RoomOffersSection, type RoomsState } from "@/components/hotel/RoomOffers";
import type { HotelDetail, HotelReview, RoomOffer } from "@/lib/hotel-data";
import {
  encodeHotelParams,
  parsePlaceParams,
  parseStayParams,
  STAY_FAILURE_COPY,
  type StayCriteria,
} from "@/lib/hotel-params";
import { saveRecentSearch } from "@/lib/recent-search";
import {
  encodeOccupancy,
  encodeSearchParams,
  fromISODate,
  type GuestRoom,
  type SearchCriteria,
} from "@/lib/search-params";

/**
 * The hotel details page.
 *
 * TWO INDEPENDENT REQUESTS, deliberately not one. Static content (name,
 * photos, facilities, description, review scores) needs only the hotel id and
 * fires on mount; pricing needs dates and guests as well, and fires only once
 * those exist. They run concurrently, render as they land, and fail
 * separately — a rates outage costs you the room cards and nothing else,
 * which is why the error state for it lives inside that section rather than
 * replacing the page.
 *
 * The URL is the source of truth for the stay, exactly as on the results
 * page: editing dates or guests in the booking widget pushes a new history
 * entry, and the refetch is driven off the URL changing rather than off the
 * widget's own state. Back/forward therefore step through pricings for free.
 */
export default function HotelPage() {
  return (
    <Suspense fallback={<PageShell />}>
      <HotelPageInner />
    </Suspense>
  );
}

function PageShell({ children }: { children?: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <main className="flex-1">
        <HeroSection forceCollapsed />
        {children}
      </main>
      <Footer />
    </div>
  );
}

function HotelPageInner() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const hotelId = params.id;

  const query = searchParams.toString();
  const parsedStay = useMemo(
    () => parseStayParams(new URLSearchParams(query)),
    [query],
  );
  const place = useMemo(
    () => parsePlaceParams(new URLSearchParams(query)),
    [query],
  );

  const stay = parsedStay.ok ? parsedStay.stay : undefined;

  /* --- Hotel metadata: fires on mount, needs nothing but the id --------- */
  const [detail, setDetail] = useState<
    | { status: "loading" }
    | { status: "ready"; hotel: HotelDetail }
    | { status: "not-found" }
    | { status: "error"; message: string }
  >({ status: "loading" });
  const [detailNonce, setDetailNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setDetail({ status: "loading" });

    fetch(`/api/hotels/${encodeURIComponent(hotelId)}`)
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
          if (body.reason === "not-found") return { notFound: true as const };
          throw new Error(body.error || `Request failed (${response.status})`);
        }
        return body as { hotel: HotelDetail };
      })
      .then((result) => {
        if (cancelled) return;
        setDetail(
          "notFound" in result
            ? { status: "not-found" }
            : { status: "ready", hotel: result.hotel },
        );
      })
      .catch((error: Error) => {
        if (!cancelled) setDetail({ status: "error", message: error.message });
      });

    return () => {
      cancelled = true;
    };
  }, [hotelId, detailNonce]);

  /* --- Reviews: also id-only, also independent ------------------------- */
  const [reviews, setReviews] = useState<{ reviews: HotelReview[]; total: number }>({
    reviews: [],
    total: 0,
  });

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/hotels/${encodeURIComponent(hotelId)}/reviews`)
      .then((response) => (response.ok ? response.json() : { reviews: [], total: 0 }))
      .then((body) => {
        if (!cancelled) {
          setReviews({ reviews: body.reviews ?? [], total: body.total ?? 0 });
        }
      })
      // A missing review strip is not worth surfacing an error for — the
      // section simply doesn't render.
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [hotelId]);

  /* --- Rates: only once there are usable dates ------------------------- */
  const [rates, setRates] = useState<RoomsState>({ status: "loading" });
  const [ratesNonce, setRatesNonce] = useState(0);

  // Just the stay half of the URL, so a change to the display-only place
  // params can never trigger a repricing.
  const stayQuery = useMemo(
    () => (stay ? encodeHotelParams({ stay }).toString() : ""),
    [stay],
  );

  useEffect(() => {
    if (!parsedStay.ok) {
      setRates(
        parsedStay.reason === "incomplete"
          ? { status: "incomplete" }
          : { status: "invalid", ...STAY_FAILURE_COPY[parsedStay.reason] },
      );
      return;
    }

    let cancelled = false;
    setRates({ status: "loading" });

    fetch(`/api/hotels/${encodeURIComponent(hotelId)}/rates?${stayQuery}`)
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(body.error || `Request failed (${response.status})`);
        }
        return body as { offers: RoomOffer[]; cheapest: string | null };
      })
      .then((body) => {
        if (!cancelled) setRates({ status: "ready", offers: body.offers ?? [] });
      })
      .catch((error: Error) => {
        if (!cancelled) setRates({ status: "error", message: error.message });
      });

    return () => {
      cancelled = true;
    };
  }, [hotelId, stayQuery, parsedStay.ok, ratesNonce]);

  /* --- Committing a new stay ------------------------------------------- */
  const [openField, setOpenField] = useState<WidgetField | null>(null);

  const applyStay = useCallback(
    (next: { checkin: string; checkout: string; rooms: GuestRoom[] }) => {
      const params = encodeHotelParams({
        stay: next,
        // Carried through untouched so the header bar and the "back to
        // results" link keep working after a repricing.
        place,
      });
      router.push(`/hotel/${encodeURIComponent(hotelId)}?${params.toString()}`);
    },
    [hotelId, place, router],
  );

  /* --- Derived view values --------------------------------------------- */
  const hotel = detail.status === "ready" ? detail.hotel : null;

  // The header search bar can only be prefilled with a REAL place id; a
  // synthetic one built from the hotel's city would look right and then
  // produce a broken search the moment it was submitted.
  const headerCriteria: SearchCriteria | undefined =
    place && stay
      ? { place, checkin: stay.checkin, checkout: stay.checkout, rooms: stay.rooms }
      : undefined;

  const backHref = headerCriteria
    ? `/search?${encodeSearchParams(headerCriteria).toString()}`
    : "/";

  /**
   * "Continue searching" on the home page reads this back — see
   * lib/recent-search.ts. Requires a real `place` (not just `stay`): a bare
   * hotel link with no destination context has nowhere meaningful for
   * "continue searching" to lead back TO, so backHref would just be "/" and
   * this intentionally skips saving rather than persist a dead link.
   *
   * Deliberately keyed on PRIMITIVES (hotel?.id, the ISO dates, an encoded
   * rooms string) rather than the `hotel`/`stay`/`headerCriteria` objects
   * themselves, which are fresh references every render — depending on
   * those directly would re-run (and re-save) this effect on every render
   * instead of only when the underlying data actually changes.
   */
  const roomsKey = stay ? encodeOccupancy(stay.rooms) : "";
  useEffect(() => {
    if (!hotel || !stay || !place) return;

    saveRecentSearch({
      category: "Stays",
      destination: place.name,
      dateLabel: formatRangeLabel({
        start: fromISODate(stay.checkin),
        end: fromISODate(stay.checkout),
      }),
      guestLabel: guestsLabelFor(
        stay.rooms.map((room) => ({ adults: room.adults, childAges: room.childAges })),
      ),
      images: hotel.images.slice(0, 3),
      href: backHref,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotel?.id, stay?.checkin, stay?.checkout, roomsKey, place?.name, backHref]);

  const cheapest =
    rates.status === "ready" && rates.offers.length ? rates.offers[0].price : null;

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <main className="flex-1">
        <HeroSection forceCollapsed initialCriteria={headerCriteria} />

        <Container className="flex flex-col gap-6 pt-3 pb-14">
          {detail.status === "loading" ? <DetailSkeleton /> : null}

          {detail.status === "not-found" ? (
            <FullPageState
              title="We couldn't find this hotel"
              body="The link may be out of date, or this property is no longer listed."
              action={
                <Link
                  href="/"
                  className="mt-2 rounded-lg bg-brand px-4 py-2 font-display text-[13px] font-medium text-white transition-opacity hover:opacity-90"
                >
                  Back to home
                </Link>
              }
            />
          ) : null}

          {detail.status === "error" ? (
            <FullPageState
              tone="error"
              title="We couldn't load this hotel"
              body={detail.message}
              action={
                <button
                  type="button"
                  onClick={() => setDetailNonce((n) => n + 1)}
                  className="mt-2 cursor-pointer rounded-lg border border-red-300 bg-white px-4 py-2 font-display text-[13px] font-medium text-red-900 transition-colors hover:bg-red-100"
                >
                  Try again
                </button>
              }
            />
          ) : null}

          {hotel ? (
            <>
              {/* Figma's own "Container" (33370:242597) holds the back link,
                  hotel-info row and gallery under one flat 20px gap — nested
                  here rather than each component owning its own spacing, so
                  that single rhythm survives the component split cleanly. */}
              <div className="flex flex-col gap-5">
                <HotelHeader hotel={hotel} backHref={backHref} />
                <HotelGallery
                  images={hotel.images}
                  total={hotel.imageCount}
                  hotelId={hotel.id}
                />
              </div>

              <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
                <div className="flex min-w-0 flex-1 flex-col gap-6">
                  {/* Each of these renders null when its data is absent, and
                      the divider is tied to the same condition so a hidden
                      section never leaves a stray rule behind. */}
                  {hotel.highlights.length > 0 ? (
                    <>
                      <SmartHighlights highlights={hotel.highlights} />
                      <Divider />
                    </>
                  ) : null}

                  {hotel.facilities.length > 0 ? (
                    <>
                      <PopularFacilities
                        facilities={hotel.facilities}
                        total={hotel.facilityCount}
                      />
                      <Divider />
                    </>
                  ) : null}

                  <RoomOffersSection
                    state={rates}
                    onRetry={() => setRatesNonce((n) => n + 1)}
                    onPickDates={() => setOpenField("when")}
                  />
                </div>

                <aside className="w-full shrink-0 lg:sticky lg:top-[140px] lg:w-[350px]">
                  <BookingWidget
                    cheapestPrice={cheapest}
                    ratesLoading={rates.status === "loading"}
                    placeLabel={place?.name ?? hotel.address.split(",")[1]?.trim() ?? ""}
                    checkin={stay?.checkin}
                    checkout={stay?.checkout}
                    rooms={stay?.rooms ?? NO_ROOMS}
                    onApply={applyStay}
                    openField={openField}
                    onOpenField={setOpenField}
                  />
                </aside>
              </div>

              {hotel.review ? (
                <>
                  <Divider />
                  <ReviewHighlights
                    summary={hotel.review}
                    reviews={reviews.reviews}
                    totalReviews={reviews.total}
                  />
                </>
              ) : null}

              {hotel.description.length > 0 ? (
                <>
                  <Divider />
                  <PropertyDescription blocks={hotel.description} />
                </>
              ) : null}
            </>
          ) : null}
        </Container>
      </main>

      <Footer />
    </div>
  );
}

/** Module-level so the booking widget's `rooms` prop keeps a stable identity
 * on a dates-less link, rather than a fresh [] on every render. */
const NO_ROOMS: GuestRoom[] = [];

function Divider() {
  return <hr className="border-[#f2f3f5]" />;
}

function FullPageState({
  title,
  body,
  action,
  tone = "neutral",
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
  tone?: "neutral" | "error";
}) {
  const isError = tone === "error";
  return (
    <div
      className={`flex flex-col items-start gap-2 rounded-[24px] border p-6 ${
        isError ? "border-red-200 bg-red-50" : "border-neutral-200 bg-white"
      }`}
    >
      <p
        className={`font-display text-[16px] font-semibold ${
          isError ? "text-red-900" : "text-neutral-900"
        }`}
      >
        {title}
      </p>
      <p className={`text-[14px] ${isError ? "text-red-800" : "text-neutral-500"}`}>
        {body}
      </p>
      {action}
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-10" aria-label="Loading hotel" aria-busy>
      <div className="flex flex-col gap-3">
        <div className="h-8 w-1/3 rounded bg-neutral-100" />
        <div className="h-4 w-1/4 rounded bg-neutral-100" />
      </div>
      <div className="flex h-[400px] gap-[10px]">
        <div className="h-full flex-1 rounded-[20px] bg-neutral-100" />
        <div className="grid h-full w-[498px] shrink-0 grid-cols-2 grid-rows-2 gap-[10px]">
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className="rounded-[20px] bg-neutral-100" />
          ))}
        </div>
      </div>
    </div>
  );
}
