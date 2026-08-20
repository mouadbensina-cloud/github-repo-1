/**
 * "Continue searching" persistence — the home page's pick-up-where-you-left-
 * off card. There is no account system in this app, so "recent" can only
 * mean "this browser": localStorage, read and written entirely client-side.
 *
 * One entry, always overwritten, not a history list: the card only ever
 * shows the SINGLE most recent search, so keeping more would just be dead
 * data nothing reads.
 *
 * The two write sites — the search results page and the hotel details page —
 * both write this exact same shape. That's what makes "3 images from the
 * hotel you were just looking at" and "3 images from the first 3 results of
 * your last search" the same feature rather than two: whichever page the
 * visitor's browser last completed a load on is simply whichever one wrote
 * here last, and the home page only ever needs to read one thing back.
 */

export type RecentSearch = {
  /** "Stays" — the only vertical this site actually searches today. Kept as
   * a field (not hardcoded in the component) so a future Flights/Experiences
   * search writes its own label without touching the reader. */
  category: string;
  destination: string;
  /** Pre-formatted ("Aug 18 - 19"), not raw ISO dates — both write sites
   * already have formatRangeLabel's Date objects in hand from their own UI,
   * and this keeps the home page from needing to import date-parsing code
   * just to redisplay a string it isn't validating. */
  dateLabel: string;
  guestLabel: string;
  /** Up to 3 real photo URLs. Fewer than 3 (or none) is fine — the card
   * falls back to grey placeholder swatches per slot, same as it always
   * has for a hotel with no matched photo. Never a placeholder URL written
   * here on purpose: an empty array is honest, a fake image is not. */
  images: string[];
  /** Where the card navigates on click — a full `/search?...` link, already
   * carrying the exact criteria that produced this entry. */
  href: string;
};

const STORAGE_KEY = "luminous:recent-search";

export function saveRecentSearch(entry: RecentSearch): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entry));
  } catch {
    // Quota exceeded, private-browsing Safari, storage disabled by a
    // extension — losing the "continue searching" card is not worth
    // surfacing an error for; the rest of the page works fine without it.
  }
}

/** Minimal shape validation, not a schema library: this only ever reads back
 * what saveRecentSearch itself wrote, so the one real risk is a stale shape
 * left over from a previous version of this file — checked for here rather
 * than trusted blindly, so that case degrades to "no card" instead of a
 * crash or a card rendering `undefined`. */
export function getRecentSearch(): RecentSearch | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<RecentSearch> | null;
    if (
      !parsed ||
      typeof parsed.category !== "string" ||
      typeof parsed.destination !== "string" ||
      typeof parsed.dateLabel !== "string" ||
      typeof parsed.guestLabel !== "string" ||
      typeof parsed.href !== "string" ||
      !Array.isArray(parsed.images)
    ) {
      return null;
    }

    return {
      category: parsed.category,
      destination: parsed.destination,
      dateLabel: parsed.dateLabel,
      guestLabel: parsed.guestLabel,
      href: parsed.href,
      images: parsed.images.filter((image): image is string => typeof image === "string"),
    };
  } catch {
    return null;
  }
}
