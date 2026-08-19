"use client";

import { useEffect, useRef, useState } from "react";
import type { PlaceSuggestion } from "@/app/api/places/route";

/** Below this, no request is made at all — matches the guard in the route. */
export const MIN_QUERY_LENGTH = 2;

/** Long enough that ordinary typing produces one request per word rather
 * than one per keystroke, short enough to still feel immediate. */
const DEBOUNCE_MS = 300;

export type AutocompleteState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; places: PlaceSuggestion[] }
  | { status: "error" };

/**
 * Debounced destination lookup against /api/places.
 *
 * Staleness is handled twice over, because the two failure modes are
 * different:
 *   - the debounce timer is cleared on every keystroke, so a burst of typing
 *     only ever issues a request for the final value
 *   - the in-flight request is aborted when the query changes again, and its
 *     resolution is additionally ignored unless it is still the current one.
 *     Abort alone isn't enough: a response can already be in the microtask
 *     queue when abort() lands, and would otherwise repaint the list with
 *     results for a prefix the user has moved past.
 *
 * `enabled` lets the caller stop lookups entirely once a suggestion has been
 * picked, so applying a selection doesn't immediately fire a search for the
 * name that selection just wrote into the input.
 */
export function usePlaceAutocomplete(
  query: string,
  enabled: boolean,
  /** Change to re-run the current query — the retry button, which has no new
   * text to trigger the effect with. */
  nonce = 0,
) {
  const [state, setState] = useState<AutocompleteState>({ status: "idle" });
  /** Bumped per attempt; a response only lands if it's still the latest. */
  const requestId = useRef(0);

  useEffect(() => {
    const trimmed = query.trim();

    if (!enabled || trimmed.length < MIN_QUERY_LENGTH) {
      // Not an error state — an empty or too-short box simply has nothing to
      // say, and should show the default panel rather than "no results".
      requestId.current++;
      setState({ status: "idle" });
      return;
    }

    const id = ++requestId.current;
    const controller = new AbortController();

    const timer = setTimeout(() => {
      setState({ status: "loading" });

      fetch(`/api/places?q=${encodeURIComponent(trimmed)}`, {
        signal: controller.signal,
      })
        .then(async (response) => {
          if (!response.ok) throw new Error(String(response.status));
          return (await response.json()) as { places: PlaceSuggestion[] };
        })
        .then(({ places }) => {
          if (id !== requestId.current) return;
          setState({ status: "ready", places: places ?? [] });
        })
        .catch(() => {
          if (controller.signal.aborted) return;
          if (id !== requestId.current) return;
          // Surfaced as a retryable inline message rather than thrown — a
          // failed lookup must never block typing or the rest of the form.
          setState({ status: "error" });
        });
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, enabled, nonce]);

  return state;
}
