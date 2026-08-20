import "server-only";

/**
 * Minimal Pexels client — two endpoints (image search, get-photo-by-id),
 * used by the home page's property-type cards (see lib/property-types.ts).
 * Marked server-only for the same reason lib/liteapi.ts is: PEXELS_API_KEY
 * must never reach the browser, so importing this from a Client Component
 * fails the build instead of silently shipping the key or a broken fetch.
 */

const BASE_URL = "https://api.pexels.com/v1";
const TIMEOUT_MS = 6000;

export type PexelsPhoto = {
  id: number;
  /** Pre-sized variants — src.landscape (1200x627) is what a wide card
   * background wants; the raw `original` is far larger than any card here
   * will ever render at. */
  src: {
    landscape: string;
    large: string;
    original: string;
  };
  alt: string | null;
};

/**
 * Both this and getPhotoById below swallow every failure into `undefined`
 * rather than throwing — a category with a bad or missing photo falls back
 * to a plain placeholder colour, same as a hotel with no matched room photo
 * elsewhere in this app, so one bad request should never take the whole
 * section down.
 */
async function pexelsGet(
  path: string,
  params: Record<string, string>,
  next: NextFetchRequestConfig | undefined,
): Promise<unknown> {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) return undefined;

  const url = new URL(`${BASE_URL}${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: { Authorization: apiKey },
      signal: controller.signal,
      ...(next ? { next } : {}),
    });
    if (!response.ok) return undefined;
    return await response.json();
  } catch {
    return undefined;
  } finally {
    clearTimeout(timeout);
  }
}

/** The first result for a query, or undefined for a query with zero matches
 * or on any request failure. */
export async function searchFirstPhoto(
  query: string,
  options?: { next?: NextFetchRequestConfig },
): Promise<PexelsPhoto | undefined> {
  const body = (await pexelsGet(
    "/search",
    { query, per_page: "1" },
    options?.next,
  )) as { photos?: PexelsPhoto[] } | undefined;
  return body?.photos?.[0];
}

/**
 * One specific, hand-picked photo by its Pexels id — for a category whose
 * auto-searched result isn't the one wanted (see HOTELS_PHOTO_ID in
 * lib/property-types.ts). The id is the numeric suffix of the photo's own
 * pexels.com/photo/... URL, not anything this app assigns.
 */
export async function getPhotoById(
  id: number,
  options?: { next?: NextFetchRequestConfig },
): Promise<PexelsPhoto | undefined> {
  return (await pexelsGet(`/photos/${id}`, {}, options?.next)) as
    | PexelsPhoto
    | undefined;
}
