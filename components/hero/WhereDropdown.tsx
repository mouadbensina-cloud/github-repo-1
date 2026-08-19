import { Icon, type IconName } from "@/components/ui/Icon";
import type { PlaceSuggestion } from "@/app/api/places/route";
import type { PlaceKind } from "@/lib/search-params";
import type { AutocompleteState } from "./usePlaceAutocomplete";

/**
 * Shown before the user has typed enough to search. Static for now — there's
 * no search history store yet — same as the home page's other placeholder
 * content. Each one still carries a real LiteAPI place ID, so picking one
 * runs a genuine search rather than a dead demo row.
 *
 * IDs and subtitles captured from a live /data/places call, not written by
 * hand — a wrong place ID here fails as an empty result set, which reads as
 * "no hotels" rather than "broken link".
 */
const RECENT_SEARCH: PlaceSuggestion = {
  id: "ChIJ53USP0nBhkcRjQ50xhPN_zw",
  name: "Milan",
  detail: "Metropolitan City of Milan, Italy",
  kind: "city",
};

const SUGGESTED_DESTINATIONS: PlaceSuggestion[] = [
  {
    id: "ChIJD7fiBh9u5kcRYJSMaMOCCwQ",
    name: "Paris",
    detail: "France",
    kind: "city",
  },
  {
    id: "ChIJgTwKgJcpQg0RaSKMYcHeNsQ",
    name: "Madrid",
    detail: "Spain",
    kind: "city",
  },
  {
    id: "ChIJOxGqeEfNpw0R0w8xT9jBBgs",
    name: "Casablanca",
    detail: "Morocco",
    kind: "city",
  },
];

const KIND_ICON: Record<PlaceKind, IconName> = {
  city: "building",
  region: "map",
  country: "globe",
  airport: "flight",
  landmark: "pin",
};

const KIND_LABEL: Record<PlaceKind, string> = {
  city: "City",
  region: "Region",
  country: "Country",
  airport: "Airport",
  landmark: "Landmark",
};

/**
 * The Where field's dropdown (Figma 33211:30523). Renders one of four things
 * depending on what the lookup is doing — default suggestions, a spinner, the
 * matches, or a failure — but always inside the same panel, so switching
 * between them only changes this content while FieldDropdownPortal morphs the
 * box around it.
 *
 * Selection is by `PlaceSuggestion`, never by display string: the caller
 * needs the place ID to actually search, and two different Parises have the
 * same name.
 */
export function WhereDropdown({
  query,
  state,
  highlightedIndex,
  onSelect,
  onHighlight,
  onRetry,
}: {
  query: string;
  state: AutocompleteState;
  /** -1 when nothing is highlighted. Driven by arrow keys in SearchPanel,
   * mirrored here so hover and keyboard share one highlight. */
  highlightedIndex: number;
  onSelect: (place: PlaceSuggestion) => void;
  onHighlight: (index: number) => void;
  onRetry: () => void;
}) {
  if (state.status === "loading") {
    return (
      <PanelShell>
        <SectionLabel>Searching…</SectionLabel>
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex w-full animate-pulse items-center gap-3">
            <span className="size-10 shrink-0 rounded-[8px] bg-surface" />
            <span className="flex flex-1 flex-col gap-1.5">
              <span className="h-3.5 w-1/3 rounded bg-surface" />
              <span className="h-3 w-1/2 rounded bg-surface" />
            </span>
          </div>
        ))}
      </PanelShell>
    );
  }

  if (state.status === "error") {
    return (
      <PanelShell>
        <p className="font-display text-[14px] font-medium text-[#384250]">
          Couldn&apos;t load destinations
        </p>
        <p className="font-display text-[12px] text-neutral-500">
          Check your connection, or keep typing to try again.
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-1 cursor-pointer self-start rounded-[8px] border border-neutral-200 px-3 py-1.5 font-display text-[12px] font-medium text-neutral-900 transition-colors hover:bg-surface"
        >
          Try again
        </button>
      </PanelShell>
    );
  }

  if (state.status === "ready" && state.places.length === 0) {
    return (
      <PanelShell>
        <p className="font-display text-[14px] font-medium text-[#384250]">
          No results for &ldquo;{query.trim()}&rdquo;
        </p>
        <p className="font-display text-[12px] text-neutral-500">
          Try a city, region, or airport instead.
        </p>
      </PanelShell>
    );
  }

  if (state.status === "ready") {
    return (
      <PanelShell>
        <SectionLabel>Destinations</SectionLabel>
        <ul role="listbox" aria-label="Destination suggestions" className="contents">
          {state.places.map((place, index) => (
            <PlaceRow
              key={place.id}
              place={place}
              index={index}
              highlighted={index === highlightedIndex}
              onSelect={onSelect}
              onHighlight={onHighlight}
            />
          ))}
        </ul>
      </PanelShell>
    );
  }

  // Idle — nothing typed yet.
  return (
    <div className="flex w-[377px] flex-col gap-6 p-6">
      <div className="flex w-full flex-col gap-3">
        <SectionLabel>Recent search</SectionLabel>
        <PlaceRow
          place={RECENT_SEARCH}
          index={0}
          highlighted={highlightedIndex === 0}
          icon="clock"
          onSelect={onSelect}
          onHighlight={onHighlight}
        />
      </div>

      <div className="flex w-full flex-col gap-3">
        <SectionLabel>Suggested destinations</SectionLabel>
        {SUGGESTED_DESTINATIONS.map((place, i) => (
          <PlaceRow
            key={place.id}
            place={place}
            index={i + 1}
            highlighted={highlightedIndex === i + 1}
            onSelect={onSelect}
            onHighlight={onHighlight}
          />
        ))}
      </div>
    </div>
  );
}

/** The idle panel's rows, flattened into the order arrow keys walk them —
 * recent search first, then the suggestions. Exported so SearchPanel can
 * resolve a highlighted index to a place without duplicating the list. */
export const IDLE_PLACES: PlaceSuggestion[] = [
  RECENT_SEARCH,
  ...SUGGESTED_DESTINATIONS,
];

function PanelShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex w-[377px] flex-col gap-3 p-6">{children}</div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-display text-[12px] tracking-[-0.12px] text-neutral-500">
      {children}
    </p>
  );
}

function PlaceRow({
  place,
  index,
  highlighted,
  icon,
  onSelect,
  onHighlight,
}: {
  place: PlaceSuggestion;
  index: number;
  highlighted: boolean;
  icon?: IconName;
  onSelect: (place: PlaceSuggestion) => void;
  onHighlight: (index: number) => void;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={highlighted}
      // mousedown, not click: the input's blur would otherwise close the
      // panel out from under the pointer before the click resolved.
      onMouseDown={(event) => {
        event.preventDefault();
        // onSelect can switch activeField to "when" synchronously, which
        // unmounts THIS dropdown's FieldDropdownPortal — but its outside-
        // click listener (a document-level `mousedown` handler) only gets
        // torn down by its effect cleanup, which is deferred, not
        // synchronous. Without stopPropagation, this same mousedown event
        // keeps bubbling to `document` and hits that now-stale listener,
        // whose panelRef is already null post-unmount, so it reads as an
        // "outside click" and closes the field the click just opened.
        // Stopping propagation here means it never reaches document at all.
        event.stopPropagation();
        onSelect(place);
      }}
      onMouseEnter={() => onHighlight(index)}
      className={`flex w-full cursor-pointer items-center gap-3 rounded-[12px] p-1 text-left transition-colors ${
        highlighted ? "bg-surface" : ""
      }`}
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-[8px] bg-surface text-neutral-500">
        <Icon name={icon ?? KIND_ICON[place.kind]} size={20} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-[2px]">
        <span className="truncate font-display text-[14px] font-medium tracking-[-0.14px] text-[#384250]">
          {place.name}
        </span>
        <span className="flex items-center gap-1 truncate font-display text-[12px] tracking-[-0.12px] text-neutral-500">
          {KIND_LABEL[place.kind]}
          <Icon name="dot" size={4} className="shrink-0 text-neutral-400" />
          <span className="truncate">{place.detail}</span>
        </span>
      </span>
    </button>
  );
}
