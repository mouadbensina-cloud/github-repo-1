"use client";

import { Suspense, useCallback, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { formatRangeLabel } from "@/components/hero/DateRangePicker";
import { HeroSection } from "@/components/hero/HeroSection";
import { guestsLabelFor } from "@/components/hero/WhoDropdown";
import { Footer } from "@/components/layout/Footer";
import {
  FilterSidebar,
  applyFilters,
  INITIAL_FILTERS,
  type Filters,
} from "@/components/search/FilterSidebar";
import { HotelCard } from "@/components/search/HotelCard";
import { SearchMap } from "@/components/search/SearchMap";
import { SearchResultsHeader } from "@/components/search/SearchResultsHeader";
import { useSearchView } from "@/components/search/useSearchView";
import {
  fromISODate,
  PARSE_FAILURE_COPY,
  parseSearchParams,
  type ParseFailure,
  type SearchCriteria,
} from "@/lib/search-params";
import { hotelHref } from "@/lib/hotel-params";
import { saveRecentSearch } from "@/lib/recent-search";
import type { Hotel } from "@/lib/search-data";

/** How many cards render up front, and how many more each "See more" click
 * reveals — also how much each new card's image fetch is staggered by
 * (index * this many ms), so a freshly-revealed batch's gallery requests
 * don't all land on LiteAPI in the same instant. */
const PAGE_SIZE = 10;

type SearchState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "unresolved-place" }
  | { status: "success"; hotels: Hotel[]; total: number; destination: string };

/**
 * The results page. The URL is the source of truth: everything it renders —
 * including the form in the hero above it — is derived from the query string,
 * so a pasted link reproduces the search exactly and back/forward step
 * through previous searches.
 *
 * useSearchParams needs a Suspense boundary to keep the shell prerenderable,
 * hence the split.
 */
export default function SearchPage() {
  return (
    <Suspense fallback={<SearchPageShell />}>
      <SearchResults />
    </Suspense>
  );
}

function SearchResults() {
  const searchParams = useSearchParams();

  // One parse for both the fetch and the form above it, so the two can never
  // disagree about what was searched.
  const parsed = useMemo(
    () => parseSearchParams(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );
  const criteria = parsed.ok ? parsed.criteria : undefined;

  return (
    <SearchPageShell criteria={criteria}>
      {parsed.ok ? (
        <ResultsBody criteria={parsed.criteria} query={searchParams.toString()} />
      ) : (
        <InvalidSearch reason={parsed.reason} />
      )}
    </SearchPageShell>
  );
}

/** The chrome that renders identically whether or not the URL was valid —
 * kept out of ResultsBody so a malformed link still gets a usable page (with
 * a working search form) rather than a bare error. */
function SearchPageShell({
  criteria,
  children,
}: {
  criteria?: SearchCriteria;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <main className="flex-1">
        <HeroSection forceCollapsed initialCriteria={criteria} />
        {children}
      </main>
      <Footer />
    </div>
  );
}

function ResultsBody({
  criteria,
  query,
}: {
  criteria: SearchCriteria;
  query: string;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const { view, setView } = useSearchView();
  const isMap = view === "map";

  const [state, setState] = useState<SearchState>({ status: "loading" });
  const [retryCount, setRetryCount] = useState(0);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [revealing, startReveal] = useTransition();

  const [sort] = useState<"price-asc">("price-asc");
  const [filters, setFilters] = useState<Filters>(INITIAL_FILTERS);
  const handleFiltersChange = useCallback((f: Filters) => {
    setFilters(f);
    setVisibleCount(PAGE_SIZE);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });

    fetch(`/api/search?${query}`)
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (body.reason === "unresolved-place") {
            return { unresolved: true as const };
          }
          throw new Error(body.error || `Search failed (${res.status})`);
        }
        return body as { hotels: Hotel[]; total: number; destination: string };
      })
      .then((result) => {
        if (cancelled) return;
        if ("unresolved" in result) {
          setState({ status: "unresolved-place" });
          return;
        }
        setState({
          status: "success",
          hotels: result.hotels,
          total: result.total,
          destination: result.destination,
        });

        // "Continue searching" on the home page reads this back — see
        // lib/recent-search.ts. Only the first 3 hotels that actually HAVE a
        // photo, not just hotels[0..2]: a hotel with no matched image would
        // otherwise put a grey swatch in the stack even though two other
        // results a few rows down have real ones.
        saveRecentSearch({
          category: "Stays",
          destination: result.destination,
          dateLabel: formatRangeLabel({
            start: fromISODate(criteria.checkin),
            end: fromISODate(criteria.checkout),
          }),
          guestLabel: guestsLabelFor(
            criteria.rooms.map((room) => ({
              adults: room.adults,
              childAges: room.childAges,
            })),
          ),
          images: result.hotels
            .map((hotel) => hotel.image)
            .filter((image): image is string => Boolean(image))
            .slice(0, 3),
          href: `/search?${query}`,
        });
      })
      .catch((error: Error) => {
        if (!cancelled) setState({ status: "error", message: error.message });
      });

    return () => {
      cancelled = true;
    };
  }, [query, retryCount]);

  /**
   * Any change to what's being listed starts back at the first page. A stale
   * "showing 30 of 200" after a new search or a re-sort would be showing the
   * top 30 of a list the user is no longer looking at.
   *
   * Deliberately separate from the fetch effect so it also covers changes
   * that reorder the existing results without refetching (sort today,
   * client-side filters when they land).
   */
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
    setFilters(INITIAL_FILTERS);
  }, [query, retryCount, sort]);

  const allHotels = state.status === "success" ? state.hotels : [];
  const hotels = useMemo(
    () => applyFilters(allHotels, filters),
    [allHotels, filters],
  );
  const total = state.status === "success" ? hotels.length : null;
  const destination =
    state.status === "success" ? state.destination : criteria.place.name;

  const visibleHotels = hotels.slice(0, visibleCount);
  const hasMore = visibleCount < hotels.length;

  return (
    <div className="search-layout mx-auto flex w-full max-w-[1440px] flex-col px-3 pt-3 pb-14 lg:flex-row">
      <div
        className="search-sidebar hidden lg:sticky lg:top-[140px] lg:block lg:h-[calc(100dvh-160px)]"
        inert={isMap}
      >
        <FilterSidebar
          hotels={allHotels}
          filters={filters}
          onFiltersChange={handleFiltersChange}
        />
      </div>

      <div className="search-list-col flex w-full flex-col gap-3">
        <SearchResultsHeader
          // The full matching total, not the number currently rendered.
          count={total}
          city={destination}
          view={view}
          onViewChange={setView}
        />

        <div className="flex flex-col gap-3">
          {state.status === "loading" ? <ResultsSkeleton /> : null}

          {state.status === "error" ? (
            <ResultsError
              message={state.message}
              onRetry={() => setRetryCount((c) => c + 1)}
            />
          ) : null}

          {state.status === "unresolved-place" ? <UnresolvedPlace /> : null}

          {state.status === "success" && allHotels.length === 0 ? (
            <ResultsEmpty destination={destination} />
          ) : null}

          {state.status === "success" &&
          allHotels.length > 0 &&
          hotels.length === 0 ? (
            <div className="flex flex-col items-start gap-2 rounded-[24px] border border-neutral-200 bg-white p-6">
              <p className="font-display text-[16px] font-semibold text-neutral-900">
                No hotels match your filters
              </p>
              <p className="font-display text-[14px] text-neutral-500">
                Try adjusting or clearing your filters to see more results.
              </p>
              <button
                type="button"
                onClick={() => handleFiltersChange(INITIAL_FILTERS)}
                className="mt-1 cursor-pointer rounded-[8px] border border-neutral-200 px-4 py-2 font-display text-[13px] font-medium text-neutral-900 transition-colors hover:bg-surface"
              >
                Clear all filters
              </button>
            </div>
          ) : null}

          {visibleHotels.map((hotel, index) => (
            <HotelCard
              key={hotel.id}
              hotel={hotel}
              // Carries the current dates and guests into the details page,
              // so it can price rooms immediately instead of opening on its
              // "add your dates" state.
              href={hotelHref(hotel.id, {
                stay: {
                  checkin: criteria.checkin,
                  checkout: criteria.checkout,
                  rooms: criteria.rooms,
                },
                place: criteria.place,
              })}
              // Staggered against the position within its own batch, so a
              // revealed batch doesn't re-stagger from the top of the list.
              imageFetchDelayMs={(index % PAGE_SIZE) * 150}
              onShowOnMap={(id) => {
                setSelectedId(id);
                setView("map");
              }}
              onHoverChange={(hovering) => {
                // Guards against a fast-moving pointer's leave (from the
                // card being left) landing after the next card's enter,
                // which would otherwise clear the pin that should now be
                // highlighted instead.
                setHoveredId((current) => {
                  if (hovering) return hotel.id;
                  return current === hotel.id ? null : current;
                });
              }}
            />
          ))}

          {hasMore ? (
            <button
              type="button"
              // Appends below the existing cards and never navigates, so the
              // page keeps its scroll position — nothing here moves what's
              // already on screen.
              onClick={() =>
                startReveal(() =>
                  setVisibleCount((c) => Math.min(c + PAGE_SIZE, hotels.length)),
                )
              }
              disabled={revealing}
              aria-busy={revealing}
              className="cursor-pointer self-center rounded-[8px] border border-neutral-200 px-6 py-2.5 font-display text-[14px] font-medium text-neutral-900 transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-60"
            >
              {revealing
                ? "Loading…"
                : `See more (${hotels.length - visibleCount} left)`}
            </button>
          ) : null}
        </div>
      </div>

      <div
        className="search-map-col hidden lg:sticky lg:top-[140px] lg:block lg:h-[calc(100dvh-160px)]"
        inert={!isMap}
      >
        <SearchMap
          hotels={hotels}
          selectedId={selectedId}
          hoveredId={hoveredId}
          onSelectHotel={setSelectedId}
        />
      </div>
    </div>
  );
}

/** A link whose criteria don't parse. Shows which part was wrong rather than
 * silently substituting a default search, and leaves the hero's form above
 * fully usable so the fix is one interaction away. */
function InvalidSearch({ reason }: { reason: ParseFailure }) {
  const { title, body } = PARSE_FAILURE_COPY[reason];
  return (
    <div className="mx-auto w-full max-w-[1440px] px-3 pt-3 pb-14">
      <div className="flex flex-col items-start gap-2 rounded-[24px] border border-neutral-200 bg-white p-6">
        <p className="font-display text-[16px] font-semibold text-neutral-900">
          {title}
        </p>
        <p className="font-display text-[14px] text-neutral-500">{body}</p>
        <Link
          href="/"
          className="mt-2 rounded-[8px] border border-neutral-200 px-4 py-2 font-display text-[13px] font-medium text-neutral-900 transition-colors hover:bg-surface"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}

function UnresolvedPlace() {
  return (
    <div className="flex flex-col items-start gap-2 rounded-[24px] border border-neutral-200 bg-white p-6">
      <p className="font-display text-[16px] font-semibold text-neutral-900">
        We couldn&apos;t find this location
      </p>
      <p className="font-display text-[14px] text-neutral-500">
        The destination in this link isn&apos;t one we can search anymore. Try
        searching for it again above.
      </p>
    </div>
  );
}

function ResultsSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-label="Loading hotels" aria-busy>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="flex h-[250px] w-full animate-pulse gap-4 rounded-[24px] border border-neutral-200 bg-white p-4"
        >
          <div className="h-full w-[221px] shrink-0 rounded-[20px] bg-neutral-100" />
          <div className="flex flex-1 flex-col gap-3 py-1">
            <div className="h-5 w-2/3 rounded bg-neutral-100" />
            <div className="h-4 w-1/2 rounded bg-neutral-100" />
            <div className="mt-auto h-8 w-1/3 self-end rounded bg-neutral-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ResultsError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-[24px] border border-red-200 bg-red-50 p-6">
      <p className="font-display text-[16px] font-semibold text-red-900">
        Couldn&apos;t load hotels
      </p>
      <p className="font-display text-[14px] text-red-800">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="cursor-pointer rounded-[8px] border border-red-300 bg-white px-4 py-2 font-display text-[13px] font-medium text-red-900 transition-colors hover:bg-red-100"
      >
        Try again
      </button>
    </div>
  );
}

function ResultsEmpty({ destination }: { destination: string }) {
  return (
    <div className="flex flex-col items-start gap-1 rounded-[24px] border border-neutral-200 bg-white p-6">
      <p className="font-display text-[16px] font-semibold text-neutral-900">
        No hotels available in {destination}
      </p>
      <p className="font-display text-[14px] text-neutral-500">
        Nothing is bookable for these dates and guests. Try different dates or
        fewer guests per room.
      </p>
    </div>
  );
}
