/**
 * The hotel-details view models, plus every mapping that turns a raw LiteAPI
 * payload into them. Pure and free of both React and `server-only`: the API
 * routes map with it on the server, and the page's own types come from here.
 *
 * The guiding rule throughout, and the reason so much of this file is
 * "return undefined": a field the API didn't give us is HIDDEN, never
 * defaulted. No "0 m²", no "Sleeps 0", no badge that guesses at a
 * cancellation policy nobody stated. Every optional field below is optional
 * because a live response was observed without it.
 */

import type {
  LiteApiHotelDetail,
  LiteApiRateOption,
  LiteApiReview,
  LiteApiSentimentAnalysis,
  LiteApiStaticRoom,
} from "./liteapi";

/* ---------------------------------------------------------------------------
   View models
--------------------------------------------------------------------------- */

/** One "Smart highlights" block: a category name and why it scored well. */
export type HotelHighlight = {
  title: string;
  description: string;
  /** 0-10. Only used for ordering — the blocks don't show a number. */
  rating: number;
};

/** One score in the "Review highlights" row. */
export type CategoryScore = {
  label: string;
  /** Formatted to one decimal, e.g. "8.4". */
  score: string;
  /** The API's own sentence, shown as the item's tooltip. */
  description: string;
  icon: FacilityIcon;
};

export type ReviewSummary = {
  /** "7.5" */
  score: string;
  /** Derived from `score` — LiteAPI returns a number, never a word. */
  label: string;
  /** "Based on 12,148 reviews" */
  countLabel: string;
  categories: CategoryScore[];
};

export type HotelReview = {
  id: string;
  author: string;
  /** "Solo traveller", humanized from the API's snake_case `type`. */
  travellerType?: string;
  /** "9.0" */
  score?: string;
  /** "Superb" — derived from score, same scale as ReviewSummary.label. */
  scoreLabel?: string;
  /** Composed from headline/pros/cons, whichever the review actually has. */
  body: string;
  /** "Fri, 08 Aug" — undefined when the API gave no parseable date, rather
   * than falling back to today's date and quietly misdating someone's stay. */
  dateLabel?: string;
  /** ISO-639 tag, so a non-English review can be marked as such. */
  language?: string;
};

export type HotelFacility = {
  label: string;
  icon: FacilityIcon;
};

/** A parsed paragraph of the property description. Plain text — see
 * parseDescriptionBlocks for why no HTML survives this far. */
export type DescriptionBlock = {
  title?: string;
  body: string;
};

export type HotelDetail = {
  id: string;
  name: string;
  /** 0 means "not rated" — the header hides the stars entirely rather than
   * rendering an empty row (LiteAPI omits starRating on unrated hotels). */
  stars: number;
  /** Single line, already joined from the API's separate address parts. */
  address: string;
  lat?: number;
  lng?: number;
  /** Gallery URLs, default photo first. May be empty. */
  images: string[];
  /** The FULL count, which is what "Show all N pictures" reports — the array
   * above is capped for payload size. */
  imageCount: number;
  facilities: HotelFacility[];
  /** Total the hotel actually lists, for "See all facilities". */
  facilityCount: number;
  description: DescriptionBlock[];
  /** Capped at 3. Empty means the section does not render at all. */
  highlights: HotelHighlight[];
  /** null means the section does not render at all. */
  review: ReviewSummary | null;
};

export type BadgeTone = "positive" | "neutral";

export type RoomBadge = {
  label: string;
  tone: BadgeTone;
  icon: "shield-check" | "shield-ban";
};

export type RoomOffer = {
  /** LiteAPI's offerId — stable per rate within one search response. */
  id: string;
  name: string;
  /** "15 m²" — absent when the API has no size for this room, or when it
   * couldn't be matched confidently (see matchStaticRoom). */
  sizeLabel?: string;
  /** From the RATE's own maxOccupancy, which is always present, rather than
   * the static room's — see matchStaticRoom for why that one is unreliable. */
  sleeps?: number;
  image?: string;
  /** The room-detail modal's 4-up gallery. Same matched static room as
   * `image` (which is just this list's first entry), so it is empty for
   * exactly the offers that show a grey placeholder on the card. */
  images: string[];
  /** Room-level amenities, distinct from the HOTEL's facilities — a pool
   * belongs to the property, a hair dryer to the room. Empty when the offer
   * couldn't be matched to a static room. */
  amenities: HotelFacility[];
  /** The static room's own description, not the hotel's. */
  description?: string;
  /** "$718" */
  price: string;
  /** Strikethrough original — only set when the API really does report a
   * higher pre-discount price. */
  originalPrice?: string;
  /** "1 room x 2 nights, incl. taxes" */
  priceNote: string;
  /** Undefined when the API stated no policy at all. */
  cancellation?: RoomBadge;
  meals: RoomBadge;
};

/* ---------------------------------------------------------------------------
   Rating labels — LiteAPI returns a 0-10 number and never a word, so every
   textual label on the page is derived here, in one place, on one scale.
--------------------------------------------------------------------------- */

/**
 * Runs all the way down, unlike the search page's hotel-average scale which
 * bottoms out at "Pleasant": this one also labels INDIVIDUAL reviews, where
 * low scores are common (a live 1.0 review would otherwise have been badged
 * "Pleasant" next to the words "No air con in heat wave").
 */
const RATING_LABELS: [min: number, label: string][] = [
  [9, "Superb"],
  [8, "Excellent"],
  [7, "Very good"],
  [6, "Good"],
  [5, "Fair"],
  [3, "Poor"],
  [0, "Very poor"],
];

export function ratingLabel(score: number): string {
  for (const [min, label] of RATING_LABELS) if (score >= min) return label;
  return "Pleasant";
}

/* ---------------------------------------------------------------------------
   Property description

   hotelDescription is HTML, but a very small and closed subset of it:
   measured across a live response, the ONLY tags present were
   <p> <strong> </strong> <br> </p>, in a strict
   `<p><strong>Title</strong><br>Body</p>` shape (with a trailing, title-less
   closing paragraph).

   So this parses that shape into plain-text blocks rather than sanitizing the
   markup and injecting it. Two reasons, in order of importance:

     1. Nothing is ever handed to dangerouslySetInnerHTML, so there is no XSS
        surface here at all — not "a sanitized one". This is third-party
        content about an arbitrary hotel; the safest renderer is the one that
        can only ever emit text nodes.
     2. It matches the design, which draws each paragraph as a titled block
        (Figma "Content Block" = Content Title + Content Description) rather
        than as a run of rich text.

   Anything unexpected in the markup degrades to plain text rather than
   throwing or rendering tags: unknown tags are stripped, and a paragraph
   with no <strong> simply has no title.
--------------------------------------------------------------------------- */

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  "#39": "'",
  "#039": "'",
};

function decodeEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, code: string) => {
    const named = ENTITIES[code.toLowerCase()];
    if (named) return named;
    if (code[0] === "#") {
      const codePoint =
        code[1] === "x" || code[1] === "X"
          ? Number.parseInt(code.slice(2), 16)
          : Number.parseInt(code.slice(1), 10);
      if (Number.isFinite(codePoint) && codePoint > 0 && codePoint < 0x110000) {
        return String.fromCodePoint(codePoint);
      }
    }
    return match;
  });
}

/** Strips every tag, then decodes entities — in that order, so an entity that
 * decodes into a "<" can never be re-read as markup. */
function toPlainText(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trim();
}

export function parseDescriptionBlocks(html: string | undefined): DescriptionBlock[] {
  if (!html) return [];

  return html
    .split(/<\/p\s*>/i)
    .map((chunk) => {
      const title = /<strong[^>]*>([\s\S]*?)<\/strong\s*>/i.exec(chunk)?.[1];
      // Drop the title from the chunk before flattening, so it isn't repeated
      // at the head of its own body.
      const bodyHtml = title
        ? chunk.replace(/<strong[^>]*>[\s\S]*?<\/strong\s*>/i, "")
        : chunk;

      return {
        title: title ? toPlainText(title) || undefined : undefined,
        body: toPlainText(bodyHtml),
      };
    })
    .filter((block) => block.body || block.title);
}

/* ---------------------------------------------------------------------------
   Facilities

   A live hotel returned 47 facilities, and the raw order is close to useless
   for a six-slot row: it opens with "WiFi available" AND "Free WiFi" (the
   same amenity twice), and the tail is almost entirely pandemic-era
   housekeeping boilerplate — "Staff adhere to local safety protocols",
   "Hand sanitizer in guest room and key areas", "Screens / Barriers between
   staff and guests for safety", "Shared stationery like menus, pens are
   removed". Rendering the first six would show duplicates and cleaning-policy
   text under generic icons.

   So the row is driven by this catalog instead: an ORDERED list of amenities
   a guest actually chooses a hotel on, each with a real icon. A hotel's
   facility strings are matched against it, at most one hit per entry (which
   is what collapses the two WiFi lines into one), and the row renders in
   catalog order — so it is always the most decision-relevant amenities the
   hotel genuinely has, never the first six strings that happened to come
   back. Anything unmatched is still COUNTED for "See all facilities (N)".
--------------------------------------------------------------------------- */

export type FacilityIcon =
  | "wifi"
  | "car"
  | "pool"
  | "paw"
  | "utensils"
  | "wine"
  | "dumbbell"
  | "spa"
  | "snowflake"
  | "ac"
  | "users"
  | "tree"
  | "hanger"
  | "elevator"
  | "bus"
  | "accessible"
  | "luggage"
  | "ban"
  | "bell"
  | "tv"
  | "lock"
  | "coffee"
  | "clock"
  | "map"
  | "sparkles"
  | "smile"
  | "component"
  | "tag"
  | "bed-double"
  | "checkmark"
  // Room-scale only (see ROOM_AMENITY_ICONS).
  | "shower"
  | "phone"
  | "wind"
  | "flame"
  | "fridge"
  | "sofa";

const FACILITY_CATALOG: {
  icon: FacilityIcon;
  label: string;
  match: RegExp;
}[] = [
  { icon: "pool", label: "Swimming pool", match: /swimming pool|\bpool\b/i },
  { icon: "wifi", label: "Free WiFi", match: /free wi-?fi/i },
  { icon: "wifi", label: "WiFi", match: /wi-?fi|internet/i },
  { icon: "car", label: "Free parking", match: /free parking/i },
  { icon: "car", label: "Parking", match: /parking/i },
  { icon: "coffee", label: "Breakfast", match: /breakfast/i },
  { icon: "utensils", label: "Restaurant", match: /restaurant|food delivered/i },
  { icon: "wine", label: "Bar", match: /\bbar\b|lounge/i },
  { icon: "dumbbell", label: "Fitness centre", match: /fitness|gym/i },
  { icon: "spa", label: "Spa", match: /\bspa\b|sauna|wellness|massage/i },
  { icon: "paw", label: "Pet friendly", match: /pets? allowed|pet.friendly/i },
  { icon: "ac", label: "Air conditioning", match: /air conditioning/i },
  { icon: "bus", label: "Airport shuttle", match: /airport shuttle|shuttle/i },
  { icon: "users", label: "Family rooms", match: /family rooms?/i },
  { icon: "tree", label: "Garden", match: /garden|sun terrace|terrace/i },
  { icon: "bell", label: "24-hour front desk", match: /24-?hour front desk/i },
  { icon: "hanger", label: "Laundry", match: /laundry|dry cleaning|ironing/i },
  { icon: "elevator", label: "Lift", match: /lift|elevator/i },
  { icon: "accessible", label: "Accessible", match: /disabled guests|accessib/i },
  { icon: "luggage", label: "Luggage storage", match: /luggage storage/i },
  { icon: "lock", label: "Safety deposit box", match: /safety deposit|safe\b/i },
  { icon: "tv", label: "TV", match: /\btv\b|television/i },
  { icon: "ban", label: "Non-smoking", match: /non-?smoking/i },
];

/** How many facility chips the design's single row fits. */
export const FACILITY_ROW_LIMIT = 6;

export function mapFacilities(raw: string[] | undefined): HotelFacility[] {
  if (!raw?.length) return [];

  const seenLabels = new Set<string>();
  const picked: HotelFacility[] = [];

  for (const entry of FACILITY_CATALOG) {
    // One chip per catalog entry, and never two chips with the same label —
    // "WiFi available" and "Free WiFi" must not both render.
    if (seenLabels.has(entry.label)) continue;
    if (!raw.some((facility) => entry.match.test(facility))) continue;

    // A more specific earlier entry already covered this icon (e.g. "Free
    // parking" beats the generic "Parking").
    if (picked.some((facility) => facility.icon === entry.icon)) continue;

    seenLabels.add(entry.label);
    picked.push({ label: entry.label, icon: entry.icon });
  }

  return picked;
}

/** How many amenity chips the room-detail modal's two rows fit. */
export const ROOM_AMENITY_LIMIT = 6;
/** The modal's gallery is a fixed 4-up grid (one large + three small). */
export const ROOM_GALLERY_LIMIT = 4;

/**
 * Room amenities, which are a genuinely different list from mapFacilities'.
 *
 * That function REPLACES the API's wording with the catalog's own label,
 * because a hotel's facility strings are noisy and duplicated ("WiFi
 * available" AND "Free WiFi"). Room amenities aren't: a live room returned
 * "Shower", "Hair dryer", "Private bathroom", "Wardrobe or closet" — specific,
 * already clean, and mostly absent from the catalog entirely. Dropping
 * everything unmatched (what mapFacilities does) would have left two chips
 * out of fourteen.
 *
 * So this keeps the API's own label and only borrows the catalog for an
 * ICON, falling back to a neutral tick when nothing matches. The wording
 * stays the property's; only the glyph is ours.
 */
/**
 * Room-scale amenities the hotel-wide FACILITY_CATALOG has no entry for —
 * it knows about swimming pools and airport shuttles, not hair dryers. Tried
 * BEFORE the catalog so the room reading wins where both could match: a room
 * listing "Shower" wants the showerhead, not the catalog's spa glyph.
 */
const ROOM_AMENITY_ICONS: { icon: FacilityIcon; match: RegExp }[] = [
  { icon: "shower", match: /shower|bath\b|bathtub|bathroom|toilet|bidet/i },
  { icon: "phone", match: /telephone|\bphone\b/i },
  { icon: "wind", match: /hair ?dryer|\bfan\b|ventilat/i },
  { icon: "flame", match: /heating|fireplace|radiator/i },
  { icon: "fridge", match: /fridge|refrigerat|minibar|mini ?bar/i },
  { icon: "sofa", match: /sofa|seating area|couch|lounge area/i },
  { icon: "coffee", match: /coffee|tea\b|kettle|espresso/i },
  { icon: "hanger", match: /wardrobe|closet|hanger|iron/i },
  { icon: "lock", match: /safe\b|safety deposit/i },
  { icon: "tv", match: /\btv\b|television|flat-?screen|satellite/i },
  { icon: "tree", match: /balcony|terrace|garden view|patio/i },
  { icon: "wifi", match: /wi-?fi|internet/i },
  { icon: "ac", match: /air ?condition/i },
  { icon: "ban", match: /non-?smoking/i },
  { icon: "accessible", match: /accessib|disabled/i },
];

export function mapRoomAmenities(raw: string[] | undefined): HotelFacility[] {
  if (!raw?.length) return [];

  const seen = new Set<string>();
  const picked: HotelFacility[] = [];

  for (const name of raw) {
    const label = name?.trim();
    if (!label) continue;

    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const room = ROOM_AMENITY_ICONS.find((entry) => entry.match.test(label));
    const facility = room
      ? undefined
      : FACILITY_CATALOG.find((entry) => entry.match.test(label));

    picked.push({ label, icon: room?.icon ?? facility?.icon ?? "checkmark" });
  }

  return picked;
}

/** Room photos, default/main shot first — the modal's gallery and the card's
 * single thumbnail both read off this one ordering. */
export function roomPhotos(room: LiteApiStaticRoom | undefined): string[] {
  const photos = room?.photos ?? [];
  return [...photos]
    .sort((a, b) => Number(Boolean(b.mainPhoto)) - Number(Boolean(a.mainPhoto)))
    .map((photo) => photo.url)
    .filter(Boolean);
}

/* ---------------------------------------------------------------------------
   Review categories

   The API's eight sentiment categories don't share names with the seven the
   design labels, so they're mapped explicitly rather than shown raw:
   Service -> Staff, Room Quality -> Room, Value for Money -> Value, Food and
   Beverage -> Food. "Overall Experience" is deliberately dropped — the big
   score badge beside the row is already the overall number, and showing it
   twice reads as a bug.

   Anything the API returns that isn't in this map still renders, under its
   own name and a neutral icon, rather than being silently swallowed.
--------------------------------------------------------------------------- */

const CATEGORY_MAP: Record<string, { label: string; icon: FacilityIcon }> = {
  cleanliness: { label: "Cleanliness", icon: "sparkles" },
  location: { label: "Location", icon: "map" },
  service: { label: "Staff", icon: "smile" },
  staff: { label: "Staff", icon: "smile" },
  amenities: { label: "Amenities", icon: "component" },
  "food and beverage": { label: "Food", icon: "utensils" },
  food: { label: "Food", icon: "utensils" },
  "value for money": { label: "Value", icon: "tag" },
  value: { label: "Value", icon: "tag" },
  "room quality": { label: "Room", icon: "bed-double" },
  room: { label: "Room", icon: "bed-double" },
};

/** Shown by the big badge instead, so it would be a duplicate in the row. */
const CATEGORY_EXCLUDED = new Set(["overall experience", "overall"]);

function mapCategories(
  sentiment: LiteApiSentimentAnalysis | undefined,
): CategoryScore[] {
  return (sentiment?.categories ?? [])
    .filter(
      (category) =>
        !CATEGORY_EXCLUDED.has(category.name.trim().toLowerCase()) &&
        Number.isFinite(category.rating),
    )
    .map((category) => {
      const known = CATEGORY_MAP[category.name.trim().toLowerCase()];
      return {
        label: known?.label ?? category.name,
        icon: known?.icon ?? ("checkmark" as FacilityIcon),
        score: category.rating.toFixed(1),
        description: category.description ?? "",
      };
    });
}

/**
 * Smart highlights. Sourced from the SAME sentiment categories as the score
 * row, not from `pros`: the design's block is a title plus an explanatory
 * sentence, which is exactly `{ name, description }`, whereas `pros` is a
 * bare fragment ("Great location") with nothing to put underneath it.
 *
 * Ordered by rating so the three shown are the hotel's genuine strengths.
 * Weak ones are filtered out entirely — a "highlight" reading "Cleanliness /
 * Several remarks indicate issues with cleanliness" is an anti-endorsement.
 */
const HIGHLIGHT_MIN_RATING = 7.5;
export const HIGHLIGHT_LIMIT = 3;

function mapHighlights(
  sentiment: LiteApiSentimentAnalysis | undefined,
): HotelHighlight[] {
  return (sentiment?.categories ?? [])
    .filter(
      (category) =>
        Number.isFinite(category.rating) &&
        category.rating >= HIGHLIGHT_MIN_RATING &&
        Boolean(category.description?.trim()) &&
        !CATEGORY_EXCLUDED.has(category.name.trim().toLowerCase()),
    )
    .sort((a, b) => b.rating - a.rating)
    .slice(0, HIGHLIGHT_LIMIT)
    .map((category) => ({
      title: CATEGORY_MAP[category.name.trim().toLowerCase()]?.label ?? category.name,
      description: category.description.trim(),
      rating: category.rating,
    }));
}

/* ---------------------------------------------------------------------------
   Hotel detail
--------------------------------------------------------------------------- */

/** How many gallery URLs travel to the client. The design shows five (one
 * hero + four thumbnails); a live hotel had 82. */
export const GALLERY_LIMIT = 5;

function formatAddress(hotel: LiteApiHotelDetail): string {
  // country is a lowercase ISO-2 ("fr") — upper-cased so it reads as a
  // country code rather than a typo.
  return [hotel.address, hotel.city, hotel.country?.toUpperCase()]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(", ");
}

export function mapHotelDetail(hotel: LiteApiHotelDetail): HotelDetail {
  const images = (hotel.hotelImages ?? [])
    .slice()
    .sort((a, b) => {
      if (a.defaultImage !== b.defaultImage) return a.defaultImage ? -1 : 1;
      return (a.order ?? 0) - (b.order ?? 0);
    })
    .map((image) => image.url)
    .filter(Boolean);

  // main_photo is usually already in hotelImages; this only matters for a
  // hotel whose gallery is empty but which still has a hero shot.
  if (!images.length && hotel.main_photo) images.push(hotel.main_photo);

  const sentiment = hotel.sentiment_analysis;
  const categories = mapCategories(sentiment);
  const score = hotel.rating;
  const reviewCount = hotel.reviewCount ?? 0;

  return {
    id: hotel.id,
    name: hotel.name?.trim() || "This hotel",
    stars: Number.isFinite(hotel.starRating) ? Number(hotel.starRating) : 0,
    address: formatAddress(hotel),
    lat: hotel.location?.latitude,
    lng: hotel.location?.longitude,
    images: images.slice(0, GALLERY_LIMIT),
    imageCount: images.length,
    facilities: mapFacilities(hotel.hotelFacilities),
    facilityCount: hotel.hotelFacilities?.length ?? 0,
    description: parseDescriptionBlocks(hotel.hotelDescription),
    highlights: mapHighlights(sentiment),
    // Needs a real score AND something to break down — a lone number with no
    // categories isn't the "Review highlights" section the design describes.
    review:
      Number.isFinite(score) && score! > 0 && categories.length
        ? {
            score: score!.toFixed(1),
            label: ratingLabel(score!),
            countLabel: `Based on ${reviewCount.toLocaleString()} review${reviewCount === 1 ? "" : "s"}`,
            categories,
          }
        : null,
  };
}

/* ---------------------------------------------------------------------------
   Reviews
--------------------------------------------------------------------------- */

function humanizeTravellerType(type: string | undefined): string | undefined {
  if (!type) return undefined;
  const words = type.replace(/_/g, " ").trim();
  return words ? words[0].toUpperCase() + words.slice(1) : undefined;
}

/**
 * `headline` is frequently "" and the body is split across `pros`/`cons`, so
 * a card composes whatever this particular review actually has. A review with
 * nothing quotable is dropped by the caller rather than rendered blank.
 */
function composeReviewBody(review: LiteApiReview): string {
  const parts = [review.headline, review.pros, review.cons]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));

  // Dedupe: some sources repeat the headline verbatim as `pros`.
  const seen = new Set<string>();
  return parts
    .filter((part) => {
      const key = part.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join(" — ");
}

/** "Fri, 08 Aug" — matches the design's short weekday-plus-day-month form.
 * UTC throughout: a review's date is a calendar day, not a moment, so there
 * is no "correct" local timezone to render it in and UTC keeps every viewer
 * seeing the same day regardless of their own. */
const REVIEW_DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  day: "2-digit",
  month: "short",
  timeZone: "UTC",
});

export function mapReviews(raw: LiteApiReview[] | undefined, limit: number): HotelReview[] {
  return (raw ?? [])
    .map((review, index): HotelReview | null => {
      const body = composeReviewBody(review);
      if (!body) return null;

      const score = Number.isFinite(review.averageScore)
        ? Number(review.averageScore)
        : undefined;
      const parsedDate = review.date ? new Date(review.date) : null;
      const dateLabel =
        parsedDate && !Number.isNaN(parsedDate.getTime())
          ? REVIEW_DATE_FORMAT.format(parsedDate)
          : undefined;

      return {
        id: `${review.date ?? "review"}-${index}`,
        author: review.name?.trim() || "Verified guest",
        travellerType: humanizeTravellerType(review.type),
        score: score !== undefined ? score.toFixed(1) : undefined,
        scoreLabel: score !== undefined ? ratingLabel(score) : undefined,
        body,
        dateLabel,
        language: review.language,
      };
    })
    .filter((review): review is HotelReview => review !== null)
    .slice(0, limit);
}

/* ---------------------------------------------------------------------------
   Room offers
--------------------------------------------------------------------------- */

/**
 * Board codes, confirmed against LiteAPI's own reference rather than the
 * industry-standard list — they differ, and the difference is not cosmetic.
 * A live rate came back as `BI` ("Breakfast Included"), which is NOT the
 * conventional `BB`; mapping only `BB` would have silently labelled a
 * breakfast-inclusive rate "No meals included".
 *
 * The numbered variants (BB1/BB2/BB3, HB1-3, FB1-3, AI1-3) are per-guest-count
 * forms of the same board, so they're normalized by stripping the digit.
 *
 * BD/BL/LD/DI/LU get their own labels rather than being forced into the
 * five the design shows: calling a lunch-and-dinner rate "Half board" would
 * be a guess about which meals are included, and this file doesn't guess.
 */
const BOARD_LABELS: Record<string, string> = {
  RO: "No meals included",
  SC: "No meals included", // self-catering, same thing for our purposes
  BI: "Breakfast included",
  BB: "Breakfast included",
  HB: "Half board",
  FB: "Full board",
  AI: "All inclusive",
  TI: "All inclusive",
  BD: "Breakfast and dinner",
  BL: "Breakfast and lunch",
  LD: "Lunch and dinner",
  DI: "Dinner included",
  LU: "Lunch included",
};

export function mealsBadge(rate: LiteApiRateOption | undefined): RoomBadge {
  const code = rate?.boardType?.trim().toUpperCase() ?? "";
  // Strip the per-guest-count suffix: BB2 -> BB.
  const normalized = code.replace(/([A-Z]{2})\d$/, "$1");
  const label = BOARD_LABELS[normalized];

  if (label && label !== "No meals included") {
    return { label, tone: "positive", icon: "shield-check" };
  }
  if (label) return { label, tone: "neutral", icon: "shield-ban" };

  // Unknown or missing code: fall back to the human-readable boardName the
  // API sends alongside it before giving up on saying anything at all.
  const boardName = rate?.boardName?.trim();
  if (boardName && !/room only/i.test(boardName)) {
    return { label: boardName, tone: "positive", icon: "shield-check" };
  }
  return { label: "No meals included", tone: "neutral", icon: "shield-ban" };
}

/**
 * "2026-09-15 08:59:00" in the policy's stated timezone (GMT on every live
 * sample). Deliberately not `new Date(string)`: that form is parsed as LOCAL
 * time by every engine, which would shift a deadline across a day boundary
 * for anyone west of GMT and print the wrong date on the badge.
 */
function parsePolicyTime(value: string | undefined): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/.exec(value);
  if (!match) return null;
  const [, y, mo, d, h, mi, s] = match;
  const time = Date.UTC(+y, +mo - 1, +d, +h, +mi, +(s ?? 0));
  return Number.isFinite(time) ? new Date(time) : null;
}

const DEADLINE_FORMAT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

/**
 * A rate is refundable (RFN) or not (NRFN); LiteAPI documents NRFN as meaning
 * ANY part of the booking is non-refundable. When it is refundable, the
 * earliest cancelPolicyInfos entry is the moment a penalty starts applying —
 * so it is the deadline free cancellation runs UP TO, which is why the badge
 * reads "before" that date.
 *
 * Returns undefined when the API stated no policy at all, so the card omits
 * the badge rather than defaulting to either answer.
 */
export function cancellationBadge(
  rate: LiteApiRateOption | undefined,
): RoomBadge | undefined {
  const policies = rate?.cancellationPolicies;
  const tag = policies?.refundableTag;
  if (!policies || !tag) return undefined;

  if (tag !== "RFN") {
    return { label: "Non-refundable", tone: "neutral", icon: "shield-ban" };
  }

  const deadlines = (policies.cancelPolicyInfos ?? [])
    .map((info) => parsePolicyTime(info.cancelTime))
    .filter((date): date is Date => date !== null && date.getTime() > Date.now())
    .sort((a, b) => a.getTime() - b.getTime());

  return {
    label: deadlines.length
      ? `Free cancellation before ${DEADLINE_FORMAT.format(deadlines[0])}`
      : "Free cancellation",
    tone: "positive",
    icon: "shield-check",
  };
}

/**
 * Static room content (size, photos) can only be attached to a priced rate by
 * NAME, and only when that name is unambiguous.
 *
 * There is no id to join on. `/data/hotel` rooms carry numeric ids (670480);
 * `/hotels/rates` roomTypes carry opaque base32 tokens
 * ("GEZDGMJNGEZDENRQ...") and, on every live sample, no `mappedRoomId`. The
 * names don't match either — a rate called "Standard Room with 1 double bed"
 * corresponds to the static room "Standard Double Room".
 *
 * So this scores token overlap and REFUSES anything short of a clear win:
 * the best candidate must cover most of its own name's words and beat the
 * runner-up by a real margin. A wrong match here would print a confidently
 * incorrect room size, which is worse than the design's own fallback of
 * simply not showing one — hence the deliberately strict thresholds.
 */
const MATCH_MIN_SCORE = 0.7;
const MATCH_MIN_MARGIN = 0.15;

const NOISE_WORDS = new Set(["room", "with", "and", "the", "a", "bed", "beds"]);

/**
 * Bed counts are written as DIGITS on the rate side and as WORDS on the
 * static side for the same room — "…with 1 double bed and 2 single beds"
 * against "…with Double Bed and Two Single Beds". Left unnormalized the two
 * never share those tokens, which cost a real match: two candidates tied
 * within 0.05 and the margin rule (rightly) refused to guess between them.
 * Folding digits to words makes that pair decisive at 1.00 vs 0.75 without
 * relaxing either threshold.
 */
const NUMBER_WORDS: Record<string, string> = {
  "1": "one",
  "2": "two",
  "3": "three",
  "4": "four",
  "5": "five",
  "6": "six",
};

function tokenize(name: string): Set<string> {
  return new Set(
    name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .map((word) => NUMBER_WORDS[word] ?? word)
      .filter((word) => word.length > 1 && !NOISE_WORDS.has(word)),
  );
}

/**
 * Some hotels' rate names are the full room name (matches the primary scorer
 * fine); others come back as a bare bed summary — "1 Double Bed" against a
 * static room list of "Classic Double Room with Access to Relaxation Area",
 * "Superior Double Room with Access to Relaxation Area". The primary scorer
 * can't win there: its denominator is the STATIC room's own token count, and
 * a six-word room name divided into a two-word rate can never clear 0.7 no
 * matter which candidate is right.
 *
 * This is the fallback for exactly that shape of failure — not a looser
 * version of the same scoring, a different, narrower signal: does the rate's
 * bed type (double/queen/king/…) appear in exactly one candidate's name? If
 * two candidates share it ("Classic Double" and "Superior Double" both have
 * "double"), that's still genuinely ambiguous and this correctly declines
 * too — it only resolves the case where elimination alone is enough,
 * regardless of how little else the name has in common.
 */
const BED_TYPE_WORDS = ["single", "double", "twin", "queen", "king", "triple", "quad"];

function bedTypeOf(tokens: Set<string>): string | undefined {
  return BED_TYPE_WORDS.find((word) => tokens.has(word));
}

export function matchStaticRoom(
  rateName: string,
  rooms: LiteApiStaticRoom[] | undefined,
): LiteApiStaticRoom | undefined {
  if (!rooms?.length || !rateName) return undefined;

  const rateTokens = tokenize(rateName);
  if (!rateTokens.size) return undefined;

  const withTokens = rooms.map((room) => ({
    room,
    tokens: tokenize(room.roomName ?? ""),
  }));

  const scored = withTokens
    .map(({ room, tokens }) => {
      if (!tokens.size) return { room, score: 0 };
      let hits = 0;
      for (const token of tokens) if (rateTokens.has(token)) hits += 1;
      return { room, score: hits / tokens.size };
    })
    .sort((a, b) => b.score - a.score);

  const [best, runnerUp] = scored;
  if (best && best.score >= MATCH_MIN_SCORE) {
    if (!runnerUp || best.score - runnerUp.score >= MATCH_MIN_MARGIN) return best.room;
  }

  const bedType = bedTypeOf(rateTokens);
  if (!bedType) return undefined;
  const byBedType = withTokens.filter(({ tokens }) => tokens.has(bedType));
  return byBedType.length === 1 ? byBedType[0].room : undefined;
}

/** "13 sqm" / "15 m2" / null -> "13 m²" / "15 m²" / undefined. The unit
 * string is genuinely inconsistent between rooms of the SAME hotel, so it is
 * normalized rather than printed. */
export function roomSizeLabel(room: LiteApiStaticRoom | undefined): string | undefined {
  const size = room?.roomSizeSquare;
  if (!size || !Number.isFinite(size) || size <= 0) return undefined;

  const unit = room?.roomSizeUnit?.toLowerCase().replace(/[^a-z0-9]/g, "") ?? "";
  // Everything LiteAPI has been seen to emit for square metres.
  const isMetric = !unit || ["sqm", "m2", "sqmeter", "sqmeters", "sqms"].includes(unit);
  return `${Math.round(size)} ${isMetric ? "m²" : "sq ft"}`;
}
