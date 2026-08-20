"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { useRouter } from "next/navigation";
import { ChatView } from "./ChatView";
import type { ChatMessage } from "./useHeroChat";
import {
  DateRangePicker,
  formatRangeLabel,
  type DateRange,
} from "./DateRangePicker";
import { FieldDropdownPortal } from "./FieldDropdownPortal";
import { WhereDropdown, IDLE_PLACES } from "./WhereDropdown";
import {
  WhoDropdown,
  DEFAULT_ROOMS,
  guestsLabelFor,
  roomsAreComplete,
  toGuestRooms,
  type DraftRoom,
} from "./WhoDropdown";
import { usePlaceAutocomplete } from "./usePlaceAutocomplete";
import { MorphIcon } from "morphicons/react";
import { SEARCH_ICON, ARROW_RIGHT_ICON } from "./searchArrowIcons";
import { SPARKLE_ICON, CLOSE_ICON, ASK_AI_GRADIENT_ID } from "./askAiIcons";
import { Icon, type IconName } from "@/components/ui/Icon";
import type { PlaceSuggestion } from "@/app/api/places/route";
import {
  encodeSearchParams,
  fromISODate,
  toISODate,
  type SearchCriteria,
  type SearchPlace,
} from "@/lib/search-params";

const MODES: { id: string; label: string; icon: IconName }[] = [
  { id: "stays", label: "Stays", icon: "stays" },
  { id: "flights", label: "Flights", icon: "flight" },
  { id: "experiences", label: "Experiences", icon: "experience" },
];

const SUGGESTIONS = [
  "Plan trip from a-z to london",
  "5-star hotels in Bali under $200, free cancellation",
  "Flight and experience in cancùn under 200$",
];

/** Shared by the Ask AI glow and its sparkle — same four stops in Figma. */
const AI_GRADIENT =
  "linear-gradient(128.322deg, #592FFF 0%, #E32FFF 44.231%, #FF2600 86.538%, #FF2F75 100%)";

/**
 * The hero search widget, in two states:
 *
 *  - "manual"  Where / When / Who fields + a blue search button (Figma 33133:37863)
 *  - "ai"      one free-text prompt + suggestion pills (Figma 33133:38068)
 *
 * Both states share one 60px field height (see .ai-field) so the trip-selector
 * row itself never jumps on toggle. The AI panel is still 40px taller overall
 * — the suggestion row plus its gap — so the panel slot always reserves that
 * taller total, keeping the hero's own height fixed regardless of mode.
 */
const PANEL_SLOT_H = 116;

/** How long the activation aura sweeps for. */
const AURA_DURATION = "1s";

/** Square side of the close button the Ask AI pill collapses into. */
const TOGGLE_AI_W = 44;

type ActiveField = "where" | "when" | "who" | null;

export function SearchPanel({
  collapsed = false,
  chatOpen = false,
  chatMessages = [],
  chatLoading = false,
  onOpenChat,
  onCloseChat,
  onSendMessage,
  initialCriteria,
  modalOpen = false,
  onOpenModal,
  onCloseModal,
}: {
  collapsed?: boolean;
  chatOpen?: boolean;
  chatMessages?: ChatMessage[];
  chatLoading?: boolean;
  onOpenChat?: () => void;
  onCloseChat?: () => void;
  onSendMessage?: (content: string) => void;
  /** Prefills every field from a deep link. Passed down from the results
   * page, which has already parsed and validated the URL for its own fetch —
   * so the form and the results can never disagree about what was searched. */
  initialCriteria?: SearchCriteria;
  /** Whether HeroSection is currently showing this same widget as a
   * full-screen modal (Figma 33133:39419) — see the `effectivelyCollapsed`
   * note below for why this matters here, not just in HeroSection. */
  modalOpen?: boolean;
  /** Fired when the collapsed bar is clicked anywhere — see the click-catcher
   * overlay below. Absent (e.g. in a context that never collapses) simply
   * means the overlay never renders, since there's nothing to open. */
  onOpenModal?: () => void;
  /** Fired the moment a search is actually submitted, so HeroSection can
   * close the modal immediately rather than waiting on a route change to
   * propagate back down as new props — same-route resubmits (already on
   * /search, searching again) wouldn't unmount anything to reset it. */
  onCloseModal?: () => void;
}) {
  const router = useRouter();
  const [mode, setMode] = useState(MODES[0].id);
  const [aiMode, setAiMode] = useState(false);
  const [query, setQuery] = useState("");
  // Bumping this remounts the aura, which restarts its animation — otherwise
  // toggling AI mode a second time would leave the finished animation in place.
  const [auraRun, setAuraRun] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  // Anchors all three field dropdowns (see FieldDropdownPortal) — they all
  // position off this same row, just left- or right-aligned to it.
  const rowRef = useRef<HTMLFormElement>(null);

  const [activeField, setActiveField] = useState<ActiveField>(null);

  /* --- Where -----------------------------------------------------------
     Two pieces of state on purpose. `destination` is whatever is in the box;
     `place` is the last suggestion actually chosen, and is what gets
     searched. Typing clears `place`, so a half-edited name can never submit
     the previous selection's ID under a different label. */
  const [destination, setDestination] = useState(
    initialCriteria?.place.name ?? "",
  );
  const [place, setPlace] = useState<SearchPlace | null>(
    initialCriteria?.place ?? null,
  );
  /** -1 = nothing highlighted. Shared by arrow keys and pointer hover. */
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  /** Bumped to re-run a failed lookup without the query having changed. */
  const [lookupNonce, setLookupNonce] = useState(0);

  const [dateRange, setDateRange] = useState<DateRange>({
    start: initialCriteria ? fromISODate(initialCriteria.checkin) : null,
    end: initialCriteria ? fromISODate(initialCriteria.checkout) : null,
  });
  // The date picker's Cancel/Apply needs something to cancel back to — this
  // is the in-progress selection, only copied into `dateRange` on Apply.
  const [draftDateRange, setDraftDateRange] = useState<DateRange>({
    start: null,
    end: null,
  });
  const [rooms, setRooms] = useState<DraftRoom[]>(
    initialCriteria
      ? initialCriteria.rooms.map((room) => ({
          adults: room.adults,
          childAges: room.childAges as (number | null)[],
        }))
      : DEFAULT_ROOMS,
  );
  // rooms already has a sane default so the dropdown isn't empty the first
  // time it opens, but the field itself should still read "Add guests"
  // until the user actually confirms it once.
  const [guestsApplied, setGuestsApplied] = useState(
    Boolean(initialCriteria),
  );
  const [submitting, setSubmitting] = useState(false);

  /**
   * `collapsed` (the raw prop) drives ONLY the "Edit ..." copy/color swap in
   * PrimaryField/TripField below — that framing ("you're editing your
   * current search") is still correct even inside the modal, since the
   * underlying page is still collapsed the whole time the modal sits on top
   * of it. Everything else that `collapsed` used to gate — AI mode, the
   * mode tabs, Ask AI, standing down open fields — is really asking "is
   * there currently room for this," which becomes false the moment the
   * modal opens: HeroSection forces this exact widget back to its full
   * expanded CSS proportions then (see globals.css's
   * `.hero-card[data-modal-open]`), so it has all the room it normally does.
   * Using the raw prop for those would leave AI mode permanently
   * un-enterable and the mode tabs permanently inert for the entire time
   * the modal is open.
   */
  const effectivelyCollapsed = collapsed && !modalOpen;

  // The collapsed bar has no room for the prompt or its suggestions, so
  // scrolling stands AI mode down.
  const aiOpen = aiMode && !effectivelyCollapsed;

  // Who's hover pill (Figma 33230:32753) visually extends past its own
  // field to cover the search button, ending 4px past the search button's
  // own right edge — the search button's opaque background just paints
  // over it, and the remaining space up to Ask AI (now an 8px gap, see
  // .ai-actions) stays bare. Who's own box can't grow that far itself (its
  // width comes from flex-grow and varies with viewport, while the search
  // button sits at a fixed distance from the row's own right edge), so this
  // is a separately-positioned overlay, measured off the two real elements
  // it spans between rather than guessed as a fixed offset. Only covers the
  // *hover* look now — the selected look is the shared sliding pill below,
  // which already knows how to extend the same way for Who.
  const whereFieldRef = useRef<HTMLDivElement>(null);
  const whenFieldRef = useRef<HTMLButtonElement>(null);
  const whoFieldRef = useRef<HTMLButtonElement>(null);
  const searchBtnRef = useRef<HTMLButtonElement>(null);
  const [whoHovered, setWhoHovered] = useState(false);
  const [whoPillStyle, setWhoPillStyle] = useState<CSSProperties | null>(
    null,
  );
  // !effectivelyCollapsed, not !collapsed: the pinned bar shouldn't show this
  // pill at all, but the modal it opens into is the full-size form and
  // should still get normal hover feedback — same distinction TripField's
  // own suppressHover prop draws.
  const whoPillVisible =
    whoHovered && activeField !== "who" && !effectivelyCollapsed;

  useLayoutEffect(() => {
    if (!whoPillVisible) return;
    const form = rowRef.current;
    const whoField = whoFieldRef.current;
    const searchBtn = searchBtnRef.current;
    if (!form || !whoField || !searchBtn) return;
    const formRect = form.getBoundingClientRect();
    const whoRect = whoField.getBoundingClientRect();
    const searchBtnRect = searchBtn.getBoundingClientRect();
    setWhoPillStyle({
      left: whoRect.left - formRect.left,
      width: searchBtnRect.right + 4 - whoRect.left,
    });
  }, [whoPillVisible]);

  // The selected field's white pill (Figma 33211:30523 / 33214:31532 /
  // 33214:32031) is one shared element sliding to whichever field is
  // active, rather than each field toggling its own background — same
  // "measure the active element, animate left/width" technique as the
  // List/Map toggle (see ViewToggle in SearchResultsHeader.tsx and
  // .trip-field-pill). Who's width still gets the search-button extension
  // from above; Where/When are just their own field's own width.
  const [activePillStyle, setActivePillStyle] =
    useState<CSSProperties | null>(null);

  useLayoutEffect(() => {
    const form = rowRef.current;
    if (!form || !activeField || aiOpen) {
      setActivePillStyle(null);
      return;
    }
    const fieldRef =
      activeField === "where"
        ? whereFieldRef
        : activeField === "when"
          ? whenFieldRef
          : whoFieldRef;
    const field = fieldRef.current;
    if (!field) return;
    const formRect = form.getBoundingClientRect();
    const fieldRect = field.getBoundingClientRect();
    let width = fieldRect.width;
    if (activeField === "who" && searchBtnRef.current) {
      width = searchBtnRef.current.getBoundingClientRect().right + 4 - fieldRect.left;
    }
    setActivePillStyle({ left: fieldRect.left - formRect.left, width });
  }, [activeField, aiOpen]);

  const toggleAi = () => {
    setAiMode((on) => {
      if (!on) setAuraRun((n) => n + 1);
      return !on;
    });
  };

  // Scrolling back to the top should land on manual search, not spring back
  // into whatever mode was active before the scroll-down — so the moment the
  // bar collapses, AI mode is stood down for good rather than just hidden.
  // Any open field dropdown goes with it — the collapsed bar has nowhere to
  // anchor one. Keyed on effectivelyCollapsed rather than the raw prop so
  // this ALSO fires when the modal closes (collapsed itself never changes
  // there — only modalOpen does) — closing the modal should land back on
  // the plain collapsed bar with nothing left open, the same as scrolling
  // down does.
  useEffect(() => {
    if (effectivelyCollapsed) {
      setAiMode(false);
      setActiveField(null);
      setWhoHovered(false);
    }
  }, [effectivelyCollapsed]);

  // Ask AI and the Where/When/Who dropdowns are mutually exclusive — opening
  // one stands the other down, same reasoning as the collapse effect above.
  useEffect(() => {
    if (aiMode) {
      setActiveField(null);
      setWhoHovered(false);
    }
  }, [aiMode]);

  useEffect(() => {
    if (chatOpen) setActiveField(null);
  }, [chatOpen]);

  // The prompt is always mounted now, so autoFocus won't fire on activation.
  useEffect(() => {
    if (aiOpen) inputRef.current?.focus();
  }, [aiOpen]);

  const activeIcon =
    MODES.find((m) => m.id === mode)?.icon ?? MODES[0].icon;

  const openField = (field: Exclude<ActiveField, null>) => {
    if (field === "when") setDraftDateRange(dateRange);
    setActiveField((current) => (current === field ? null : field));
  };

  /* --- Destination autocomplete ---------------------------------------
     Lookups are suspended once a place is chosen (`!place`), so applying a
     selection — which writes that place's name into the box — doesn't
     immediately search for the name it just wrote. `lookupNonce` re-arms a
     query string that hasn't otherwise changed, for the error retry. */
  const autocompleteState = usePlaceAutocomplete(
    destination,
    activeField === "where" && !place,
    lookupNonce,
  );

  /** What the arrow keys are currently walking: the live matches, or the
   * default panel's rows when nothing has been typed. */
  const navigablePlaces: PlaceSuggestion[] =
    autocompleteState.status === "ready"
      ? autocompleteState.places
      : autocompleteState.status === "idle"
        ? IDLE_PLACES
        : [];

  const handleDestinationChange = (value: string) => {
    setDestination(value);
    // Editing after choosing invalidates the stored ID — the box no longer
    // describes that place, and searching it would be a lie.
    setPlace(null);
    setHighlightedIndex(-1);
    if (value.trim()) setActiveField("where");
  };

  const handlePlaceSelect = (selected: PlaceSuggestion) => {
    setPlace({ id: selected.id, name: selected.name, kind: selected.kind });
    setDestination(selected.name);
    setHighlightedIndex(-1);
    // Auto-advances into When — but only the first time through (no dates
    // chosen yet). If dates are already set, this is someone correcting the
    // destination after having filled the rest, not a fresh top-to-bottom
    // fill, so it just closes like every other selection.
    if (!dateRange.start) {
      openField("when");
    } else {
      setActiveField(null);
    }
  };

  const handleWhereKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      setActiveField(null);
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (!navigablePlaces.length) return;
      event.preventDefault();
      if (activeField !== "where") setActiveField("where");
      const step = event.key === "ArrowDown" ? 1 : -1;
      setHighlightedIndex((current) => {
        const next = current + step;
        // Wraps, so holding one arrow key cycles rather than dead-ending.
        if (next < 0) return navigablePlaces.length - 1;
        if (next >= navigablePlaces.length) return 0;
        return next;
      });
      return;
    }

    if (event.key === "Enter" && activeField === "where") {
      const highlighted = navigablePlaces[highlightedIndex];
      if (highlighted) {
        // Selecting, not submitting — the form's own submit would otherwise
        // fire on the same Enter with no place chosen yet.
        event.preventDefault();
        handlePlaceSelect(highlighted);
      }
    }
  };

  const handleDateApply = () => {
    setDateRange(draftDateRange);
    // Chains into Who only if Where was already confirmed — the "only when
    // I do it in that order" rule. Reaching When with no place chosen means
    // it was opened out of sequence (skipping Where), so this just closes
    // instead of dragging the user into a step they didn't ask for next.
    // `!guestsApplied` keeps it to the first pass, same reasoning as Where's
    // own guard above.
    if (place && !guestsApplied) {
      setActiveField("who");
    } else {
      setActiveField(null);
    }
  };

  const handleDateCancel = () => {
    setDraftDateRange(dateRange);
    setActiveField(null);
  };

  const handleGuestsApply = () => {
    setGuestsApplied(true);
    setActiveField(null);
  };

  const dateLabel = formatRangeLabel(dateRange);
  const guestsLabel = guestsApplied ? guestsLabelFor(rooms) : "";

  /* --- Submission ------------------------------------------------------
     Everything the search needs, checked before the button will fire: a
     chosen place (not just typed text), a complete date range, and an age
     for every child. */
  const canSubmit =
    Boolean(place) &&
    Boolean(dateRange.start && dateRange.end) &&
    roomsAreComplete(rooms);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (aiOpen) {
      onCloseModal?.();
      if (query.trim()) {
        onSendMessage?.(query);
        setQuery("");
      } else {
        onOpenChat?.();
      }
      return;
    }
    if (!canSubmit || !place || !dateRange.start || !dateRange.end) {
      // Opens the first field that isn't satisfied yet, in Where -> When ->
      // Who order, rather than failing silently — reachable both from an
      // Enter keypress inside a field and from the search button itself,
      // which stays clickable even with empty fields specifically so this
      // runs.
      setActiveField(!place ? "where" : !dateRange.end ? "when" : "who");
      return;
    }

    const params = encodeSearchParams({
      place,
      checkin: toISODate(dateRange.start),
      checkout: toISODate(dateRange.end),
      rooms: toGuestRooms(rooms),
    });

    setSubmitting(true);
    setActiveField(null);
    // Closed explicitly here rather than left to the initialCriteria effect
    // below: a search from the home page navigates away and unmounts this
    // instance anyway, but re-searching from the modal while ALREADY on
    // /search is a same-route update — new props arrive, nothing unmounts,
    // and this is the one signal that's immediate rather than waiting on
    // that round trip.
    onCloseModal?.();
    // push, not replace — each search becomes its own history entry, so back
    // steps through previous searches instead of leaving the page.
    router.push(`/search?${params}`);
  };

  // The new results arriving is what ends the loading state. Keyed on the
  // criteria the parent handed back down, so it clears on a real navigation
  // rather than on a timer.
  useEffect(() => {
    setSubmitting(false);
  }, [initialCriteria]);

  return (
    <div className="hero-search-col relative flex w-full max-w-[874px] flex-col items-center gap-2 lg:order-2 lg:h-full lg:py-10">
      {/* The whole collapsed bar is one click target (Figma 33133:39419):
          there's no room down here to edit anything inline, so any click
          just asks HeroSection to open the same widget as a full-screen
          modal instead. Sized to this component's own root rather than
          measured against a ref — since it's a sibling painted after
          everything else here, `inset-0` on THIS root is already exactly
          the collapsed bar's own footprint, no measurement needed. Absent
          once the modal is open (nothing left to intercept — the real
          fields underneath take over) or mid-chat (that has its own
          takeover, same reasoning as handleSubmit's onCloseModal call). */}
      {effectivelyCollapsed && !chatOpen ? (
        <button
          type="button"
          aria-label="Edit search"
          onClick={() => onOpenModal?.()}
          className="absolute inset-0 z-20 cursor-pointer"
        />
      ) : null}

      {/* Both the mode-tabs+field content and ChatView live inside this same
          876px column, one on top of the other — matching Figma exactly,
          where the chat view's Back button and input sit in the identical
          slot the tabs and field occupy by default, not spanning the full
          hero width the way logo/actions do. */}
      <div className="hero-search-stage relative w-full lg:h-full">
        <div
          className="hero-search-content flex w-full flex-col items-center gap-2"
          inert={chatOpen}
        >
          <ModeSelector
            mode={mode}
            onChange={setMode}
            collapsed={effectivelyCollapsed}
          />

          <div
            className="hero-panel-slot w-full"
            style={{ "--panel-slot": `${PANEL_SLOT_H}px` } as CSSProperties}
          >
            <div
              data-spotlight-block
              data-ai={aiOpen}
              className="ai-panel relative flex w-full flex-col bg-white p-2 drop-shadow-[0px_15px_10px_rgba(0,0,0,0.03)]"
            >
          {aiOpen && auraRun > 0 && (
            <span
              key={auraRun}
              aria-hidden
              className="ai-aura"
              style={{ "--ai-aura-duration": AURA_DURATION } as CSSProperties}
            >
              <span className="ai-aura__ring" />
            </span>
          )}

          <form
            ref={rowRef}
            onSubmit={handleSubmit}
            data-ai={aiOpen}
            className={`ai-field relative flex w-full items-center justify-between gap-4 overflow-clip rounded-[24px] border border-neutral-200 py-4 pr-2 pl-6 shadow-[0px_15px_20px_0px_rgba(0,0,0,0.03)] transition-colors ${
              !aiOpen && activeField ? "bg-surface" : "bg-white"
            }`}
          >
            {!aiOpen && whoPillVisible && whoPillStyle ? (
              <span
                aria-hidden
                className="pointer-events-none absolute top-[3px] h-[52px] rounded-[20px] bg-surface transition-colors"
                style={whoPillStyle}
              />
            ) : null}

            {!aiOpen && activePillStyle ? (
              <span
                aria-hidden
                className="trip-field-pill pointer-events-none absolute top-[3px] h-[52px] rounded-[20px] bg-white shadow-[0px_0px_6px_1px_rgba(0,0,0,0.08)]"
                style={activePillStyle}
              />
            ) : null}

            <div className="relative flex min-w-0 flex-1 items-center">
              {/* The selected mode's icon, arriving inside the field as the
                  tab strip above collapses away. Lives inside this flex-1
                  row rather than as a form-level child so it doesn't pick up
                  the form's own gap-4 while it's collapsed to 0 width — that
                  gap doesn't know the chip is invisible and would otherwise
                  insert a permanent 16px of left padding that was never
                  there in the pre-collapse design. Its own margin-right
                  (below) is the only spacing it contributes, and that's 0
                  until it actually starts opening. */}
              <span aria-hidden className="hero-mode-chip">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-softer bg-brand/10 text-brand shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
                  <Icon name={activeIcon} />
                </span>
              </span>

              <PrimaryField
                aiMode={aiOpen}
                query={query}
                onQueryChange={setQuery}
                inputRef={inputRef}
                destination={destination}
                onDestinationChange={handleDestinationChange}
                onDestinationKeyDown={handleWhereKeyDown}
                fieldRef={whereFieldRef}
                active={activeField === "where"}
                onOpen={() => setActiveField("where")}
                listboxOpen={activeField === "where"}
                collapsed={collapsed}
                suppressHover={effectivelyCollapsed}
              />
              <CollapsibleGroup open={!aiOpen}>
                <FieldSeparator />
                <TripField
                  label="When"
                  value={dateLabel || (collapsed ? "Edit dates" : "Add dates")}
                  applied={!!dateLabel}
                  onClick={() => openField("when")}
                  buttonRef={whenFieldRef}
                  active={activeField === "when"}
                  collapsed={collapsed}
                  suppressHover={effectivelyCollapsed}
                />
                <FieldSeparator />
                <TripField
                  label="Who"
                  value={guestsLabel || (collapsed ? "Edit guests" : "Add guests")}
                  applied={!!guestsLabel}
                  onClick={() => openField("who")}
                  overlayControlled
                  buttonRef={whoFieldRef}
                  onMouseEnter={() => setWhoHovered(true)}
                  onMouseLeave={() => setWhoHovered(false)}
                  collapsed={collapsed}
                  suppressHover={effectivelyCollapsed}
                />
              </CollapsibleGroup>
            </div>

            <div
              data-ai={aiOpen}
              className="ai-actions flex shrink-0 items-center"
            >
              {/* Voice input, AI mode only — an addition alongside the blue
                  button below, not an alternative swapped in for it. */}
              <button
                type="button"
                aria-label="Search by voice"
                data-show={aiOpen}
                inert={!aiOpen}
                className="ai-swap flex size-10 shrink-0 items-center justify-center rounded-[16px] text-neutral-900 transition-colors hover:bg-neutral-200/60"
              >
                <Icon name="mic" />
              </button>

              {/* Always visible — only the icon inside changes. Previously
                  this whole button swapped out for the neutral mic button on
                  AI activation; now the mic gets its own slot (above) and
                  this one stays put, blue, submit-styled the whole time. */}
              <button
                ref={searchBtnRef}
                type="submit"
                aria-label={aiOpen ? "Send" : "Search"}
                // Only gated in manual mode — the AI prompt has its own
                // (empty-query) rules and shouldn't inherit the trip form's.
                disabled={!aiOpen && submitting}
                aria-busy={submitting}
                className="relative grid size-10 shrink-0 place-items-center overflow-hidden rounded-[16px] bg-brand text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {submitting ? (
                  <span
                    aria-hidden
                    className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                  />
                ) : (
                  <MorphIcon
                    icon={aiOpen ? ARROW_RIGHT_ICON : SEARCH_ICON}
                    size={18}
                    strokeWidth={2}
                    color="currentColor"
                    spring="snappy"
                    reducedMotion="user"
                  />
                )}
              </button>

              {/* Collapses to nothing as the bar shrinks — Figma's collapsed
                  frame has no Ask AI affordance. Back once the modal reopens
                  the full width (effectivelyCollapsed), same reasoning as
                  everywhere else that split. */}
              <span
                className="hero-askai"
                data-collapsed={effectivelyCollapsed}
                inert={effectivelyCollapsed}
              >
                <AskAiButton active={aiOpen} onToggle={toggleAi} />
              </span>
            </div>
          </form>

          {activeField ? (
            <FieldDropdownPortal
              anchorRef={rowRef}
              align={activeField === "who" ? "right" : "left"}
              onClose={
                activeField === "when"
                  ? handleDateCancel
                  : () => setActiveField(null)
              }
            >
              {activeField === "where" ? (
                <WhereDropdown
                  query={destination}
                  state={autocompleteState}
                  highlightedIndex={highlightedIndex}
                  onSelect={handlePlaceSelect}
                  onHighlight={setHighlightedIndex}
                  onRetry={() => setLookupNonce((n) => n + 1)}
                />
              ) : activeField === "when" ? (
                <DateRangePicker
                  range={draftDateRange}
                  onChange={setDraftDateRange}
                  onCancel={handleDateCancel}
                  onApply={handleDateApply}
                />
              ) : (
                <WhoDropdown
                  rooms={rooms}
                  onChange={setRooms}
                  onApply={handleGuestsApply}
                />
              )}
            </FieldDropdownPortal>
          ) : null}

          <div className="ai-suggest" data-open={aiOpen} inert={!aiOpen}>
            <div className="no-scrollbar flex items-start gap-2 overflow-x-auto pt-2">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => {
                    onCloseModal?.();
                    onSendMessage?.(suggestion);
                  }}
                  className="flex h-8 shrink-0 items-center rounded-[800px] border border-neutral-300 bg-white px-2.5 py-0.5 text-center text-[12px] font-medium tracking-[-0.12px] text-neutral-800 transition-colors hover:border-neutral-400"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
          </div>
          </div>
        </div>

        <ChatView
          open={chatOpen}
          onBack={() => onCloseChat?.()}
          messages={chatMessages}
          loading={chatLoading}
          onSend={(content) => onSendMessage?.(content)}
        />
      </div>
    </div>
  );
}

function ModeSelector({
  mode,
  onChange,
  collapsed,
}: {
  mode: string;
  onChange: (id: string) => void;
  collapsed: boolean;
}) {
  return (
    <div
      className="hero-mode-row no-scrollbar flex w-full items-center justify-start overflow-x-auto sm:justify-center"
      inert={collapsed}
    >
      <div
        data-spotlight-block
        className="hero-mode-pill mx-auto flex shrink-0 items-center gap-1 rounded-[20px] border border-white/10 bg-white p-1 backdrop-blur-[17px]"
      >
        {MODES.map((item) => {
          const active = item.id === mode;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange(item.id)}
              aria-pressed={active}
              className={`flex h-[42px] items-center justify-center gap-1.5 rounded-softer px-4 py-2 font-display text-[14px] tracking-[-0.112px] transition-colors ${
                active
                  ? "bg-brand/10 text-brand shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]"
                  : "text-neutral-600 hover:bg-[#f5f5f8]"
              }`}
            >
              <Icon name={item.icon} />
              <span className="hero-tab-label">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Toggles the AI panel. The "Ask AI" pill collapses into a 44px square close
 * button; its open width is measured once from the natural layout so the label
 * can change without hard-coding a number.
 */
function AskAiButton({
  active,
  onToggle,
}: {
  active: boolean;
  onToggle: () => void;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [pillWidth, setPillWidth] = useState<number>();

  useEffect(() => {
    if (buttonRef.current) {
      setPillWidth(buttonRef.current.getBoundingClientRect().width);
    }
  }, []);

  return (
    <span
      className="group/ai relative isolate flex shrink-0"
      style={{ "--ai-gradient": AI_GRADIENT } as CSSProperties}
    >
      {/* Blurred gradient bloom that fades in behind the button on hover.
          Figma specs it as 88.952 x 35.609 on the 93.945 x 44 pill; expressed as
          insets instead of fixed sizes that is 2.657% horizontally and 4.2px
          vertically, so it keeps the same proportions when the button collapses
          to the 44px close square rather than overhanging it. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-[2.657%] inset-y-[4.2px] -z-10 rounded-[12px] opacity-0 blur-[6.5px] transition-opacity duration-300 group-hover/ai:opacity-40"
        style={{ backgroundImage: AI_GRADIENT }}
      />
      <button
        ref={buttonRef}
        type="button"
        onClick={onToggle}
        aria-pressed={active}
        aria-label={active ? "Close AI search" : undefined}
        style={{ width: active ? TOGGLE_AI_W : pillWidth }}
        className={`ai-toggle relative grid h-11 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-softer bg-surface group-hover/ai:bg-white ${
          active ? "border border-white text-neutral-500" : "text-neutral-900"
        }`}
      >
        <span
          aria-hidden={active}
          data-show={!active}
          className="ai-swap col-start-1 row-start-1 flex items-center gap-1.5 py-2 pr-4 pl-[14px] font-display text-[14px] whitespace-nowrap tracking-[-0.112px]"
        >
          {/* Reserves the sparkle's footprint so the text doesn't shift —
              the real glyph is the MorphIcon below, positioned to sit
              exactly here regardless of which state is showing (see its own
              comment for why one fixed spot works for both). */}
          <span aria-hidden className="size-[18px] shrink-0" />
          Ask AI
        </span>

        {/* Sparkle <-> close as one continuously morphing shape (not a
            crossfade) rather than two icons swapped by opacity — mirrors the
            search/send button's MorphIcon treatment. Both source icons are
            closed, fill-drawn silhouettes (not stroke icons like search's),
            so `fill`/`stroke` are overridden via the props morphicons spreads
            straight onto its root <svg> after its own stroke defaults —
            without that override this would render as a hollow traced
            outline instead of a solid glyph.

            Positioned per state, not one fixed spot: the sparkle sits at
            pl-[14px] to match the open pill's text row, but the close glyph
            is truly centred in the collapsed 44px square — a fixed offset
            put it visibly off-centre there. */}
        <MorphIcon
          icon={active ? CLOSE_ICON : SPARKLE_ICON}
          size={18}
          spring="snappy"
          reducedMotion="user"
          fill="currentColor"
          stroke="none"
          className={`ai-icon-morph pointer-events-none absolute top-1/2 -translate-y-1/2 text-neutral-500 group-hover/ai:[fill:url(#ask-ai-icon-gradient)] ${
            active ? "left-1/2 -translate-x-1/2" : "left-[14px]"
          }`}
        />
      </button>

      {/* Paint server only — never rendered visibly (0x0, no layout box).
          `url(#...)` fill references resolve by id anywhere in the document,
          so this doesn't need to live inside the MorphIcon's own <svg>. */}
      <svg width="0" height="0" aria-hidden className="absolute">
        <defs>
          <linearGradient
            id={ASK_AI_GRADIENT_ID}
            x1="0%"
            y1="0%"
            x2="100%"
            y2="38%"
          >
            <stop offset="0%" stopColor="#592FFF" />
            <stop offset="44.231%" stopColor="#E32FFF" />
            <stop offset="86.538%" stopColor="#FF2600" />
            <stop offset="100%" stopColor="#FF2F75" />
          </linearGradient>
        </defs>
      </svg>
    </span>
  );
}

/**
 * The leftmost field, unified across both states: "Where" / "Search
 * destinations" IS "Plan your trip" / the AI prompt — same slot, same text
 * style, just a crossfade between two labels and two value elements stacked
 * in place. Splitting label and value into their own small stacks (rather
 * than swapping the whole field as one block) is what makes the text read as
 * morphing in place instead of the old block sliding out from underneath.
 *
 * The manual-mode value is a real text input now (not a static button) so a
 * destination can be typed — clicking or focusing it opens WhereDropdown the
 * same way TripField's onClick opens When/Who. The selected-state pill
 * itself isn't painted here — it's SearchPanel's shared sliding
 * `activePillStyle` overlay (Figma 33214:32488 hover, 33211:30523
 * selected) — this div only owns the hover treatment and reports its own
 * rect via `fieldRef` for that overlay to measure. `active` exists purely
 * to turn that hover treatment off while selected: the overlay paints
 * *behind* this div (so When/Who's own text stays on top of it — see
 * SearchPanel), which means this div's own hover:bg-surface would
 * otherwise still paint over the white selected pill on rollover.
 *
 * `collapsed` swaps the empty-state copy and its color (Figma 33325:31409):
 * the sticky compact bar reads "Edit destinations" in the same dark
 * `#0d121c` the applied value uses, rather than the tall bar's lighter,
 * grey "Search destinations" — since at that point the framing is "edit
 * your current search," not "start one." It's the discrete `collapsed`
 * boolean, not the continuous --collapse-p the bar's own geometry animates
 * on: this codebase already treats state-driven copy swaps as a triggered
 * change (see useHeroCollapse's own doc comment), only visual dimensions
 * interpolate continuously.
 */
function PrimaryField({
  aiMode,
  query,
  onQueryChange,
  inputRef,
  destination,
  onDestinationChange,
  onDestinationKeyDown,
  fieldRef,
  active,
  onOpen,
  listboxOpen,
  collapsed,
  suppressHover,
}: {
  aiMode: boolean;
  query: string;
  onQueryChange: (value: string) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  destination: string;
  onDestinationChange: (value: string) => void;
  onDestinationKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  fieldRef: React.RefObject<HTMLDivElement | null>;
  active: boolean;
  onOpen: () => void;
  listboxOpen: boolean;
  collapsed: boolean;
  /** The pinned, thin collapsed bar (not the modal it opens into, which
   * stays fully hoverable) has no room for the hover pill to read as
   * anything but a stray flash — see the same prop on TripField. */
  suppressHover?: boolean;
}) {
  return (
    <div
      ref={fieldRef}
      className={`hero-primary-field -ml-[21px] -mr-4 flex h-[52px] min-w-0 basis-0 flex-col items-start justify-center gap-1 rounded-[20px] pl-[21px] pr-4 transition-colors ${
        active || suppressHover ? "" : "hover:bg-surface"
      }`}
    >
      <div className="grid w-full">
        <span
          data-show={!aiMode}
          inert={aiMode}
          className="ai-swap col-start-1 row-start-1 truncate font-display text-[12px] tracking-[-0.24px] text-neutral-500"
        >
          Where
        </span>
        <label
          htmlFor="trip-query"
          data-show={aiMode}
          inert={!aiMode}
          className="ai-swap col-start-1 row-start-1 truncate font-display text-[12px] tracking-[-0.24px] text-neutral-500"
        >
          Plan your trip
        </label>
      </div>

      <div className="grid w-full min-w-0">
        <input
          type="text"
          value={destination}
          onChange={(event) => onDestinationChange(event.target.value)}
          onKeyDown={onDestinationKeyDown}
          onFocus={onOpen}
          placeholder={collapsed ? "Edit destinations" : "Search destinations"}
          data-show={!aiMode}
          inert={aiMode}
          role="combobox"
          aria-expanded={listboxOpen}
          aria-autocomplete="list"
          autoComplete="off"
          className={`ai-swap col-start-1 row-start-1 w-full truncate bg-transparent text-left text-[14px] font-medium tracking-[-0.28px] text-neutral-900 outline-none ${
            collapsed ? "placeholder:text-[#0d121c]" : "placeholder:text-neutral-400"
          }`}
        />
        <input
          id="trip-query"
          ref={inputRef}
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="e.g. 5-star hotels in Paris next weekend with breakfast"
          data-show={aiMode}
          inert={!aiMode}
          className="ai-swap col-start-1 row-start-1 w-full truncate bg-transparent text-[14px] font-medium tracking-[-0.28px] text-neutral-900 outline-none placeholder:text-neutral-400"
        />
      </div>
    </div>
  );
}

/**
 * When/Who shrink away into this on AI activation. It carries its own
 * flex-grow (2 — matching When + Who's original 1 + 1 share) rather than
 * being sized from its content, for two reasons at once:
 *
 * 1. Keeps Where/PrimaryField at its original ~1.7-of-3.7 share instead of
 *    grabbing every pixel this group isn't using — that greedy-PrimaryField
 *    version was what squeezed this group below its content's width and
 *    truncated "Add guests".
 * 2. Because the group's own width is now a real flex-resolved number
 *    (not shrink-to-fit), the flex-grow split between When and Who *inside*
 *    it has actual leftover space to divide — which is the condition that
 *    flex-grow + flex-basis:0 needs to behave predictably at all. (An
 *    earlier version measured this group's width with
 *    `getBoundingClientRect` instead; that raced the "Circular Std" web
 *    font swap and could grab a too-narrow number on a cold load.)
 *
 * flex-grow transitioning 2 -> 0 is what produces the "widen into the freed
 * space" effect: as this group's share shrinks, the sibling's constant 1.7
 * share simply becomes a bigger fraction of the row.
 */
function CollapsibleGroup({
  open,
  children,
}: {
  open: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      data-open={open}
      inert={!open}
      className="ai-collapse flex min-w-0 basis-0 items-center gap-5 overflow-hidden"
    >
      {children}
    </div>
  );
}

function TripField({
  label,
  value,
  applied,
  onClick,
  grow = 1,
  overlayControlled = false,
  active = false,
  buttonRef,
  onMouseEnter,
  onMouseLeave,
  collapsed,
  suppressHover,
}: {
  label: string;
  value: string;
  applied: boolean;
  onClick: () => void;
  grow?: number;
  // Who's hover is painted by a separate overlay in SearchPanel (see
  // whoPillStyle) rather than by this button, since it needs to extend past
  // Who's own box to cover the search button — this button just stays
  // visually transparent and reports hover so SearchPanel knows to show it.
  // The selected-state pill (for every field, including Who) is likewise
  // painted externally, by the shared sliding `activePillStyle` overlay,
  // which paints *behind* this button — so `active` (When only; Who is
  // already always-transparent via overlayControlled) turns this button's
  // own hover:bg-surface off while selected, otherwise it'd still paint
  // over that white pill on rollover.
  overlayControlled?: boolean;
  active?: boolean;
  buttonRef?: React.RefObject<HTMLButtonElement | null>;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  /** Darkens the unfilled/placeholder value text to match the applied
   * style — see PrimaryField's doc comment for why (Figma 33325:31409). The
   * caller also swaps `value` itself to "Edit ..." copy when this is true;
   * this prop only controls color/weight, not the string. Deliberately the
   * RAW collapsed prop rather than effectivelyCollapsed — this copy still
   * says "Edit ..." even with the modal open, since editing via the modal is
   * still editing the current search. suppressHover below is the one that
   * needs the modal-aware value instead. */
  collapsed?: boolean;
  /** effectivelyCollapsed, not collapsed — see PrimaryField's own doc
   * comment for the same distinction. The pinned bar has no room for the
   * hover pill to read as anything but a stray flash; the modal it opens
   * into is the full-size form and should hover normally. */
  suppressHover?: boolean;
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{ flexGrow: grow }}
      className={`-mx-4 flex h-[52px] min-w-0 basis-0 cursor-pointer flex-col items-start justify-center gap-1 rounded-[20px] px-4 text-left transition-colors ${
        overlayControlled || active || suppressHover ? "" : "hover:bg-surface"
      }`}
    >
      <span className="truncate font-display text-[12px] tracking-[-0.24px] text-neutral-500">
        {label}
      </span>
      {/* Applied values read darker/bolder than the placeholder text (Figma
          33214:32031's "Paris"/"Aug 29 - 30" vs "Add guests") — same weight
          the AI prompt's own placeholder uses when nothing's applied yet, so
          the two states still read as one continuous style. */}
      <span
        className={`w-full truncate text-[14px] tracking-[-0.28px] ${
          applied
            ? "font-semibold text-[#0d121c]"
            : collapsed
              ? "font-medium text-[#0d121c]"
              : "font-medium text-neutral-400"
        }`}
      >
        {value}
      </span>
    </button>
  );
}

function FieldSeparator() {
  return <span aria-hidden className="h-4 w-px shrink-0 bg-neutral-200" />;
}
