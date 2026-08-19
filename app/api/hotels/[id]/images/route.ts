import { NextResponse } from "next/server";
import { getHotelImages, LiteApiError } from "@/lib/liteapi";

/** A real gallery can run ~27 photos deep — a card carousel doesn't need
 * more than a handful, and capping here keeps the response small too. */
const MAX_CAROUSEL_IMAGES = 5;

/**
 * GET /api/hotels/:id/images — the photo gallery for one hotel's card
 * carousel. Separate from /api/hotels/:id (which proxies the full detail
 * payload) so a card only pulls down URLs, not rooms/policies/reviews.
 *
 * Cached for an hour server-side: the sandbox key's rate limit is tight
 * enough that mounting a page of cards, each fetching its own gallery,
 * is worth protecting from repeat dev-mode reloads hitting LiteAPI again
 * for hotels whose photos were already fetched moments ago.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const images = await getHotelImages(id, { next: { revalidate: 3600 } });
    return NextResponse.json({
      images: images.slice(0, MAX_CAROUSEL_IMAGES).map((image) => image.url),
    });
  } catch (error) {
    if (error instanceof LiteApiError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status ?? 502 },
      );
    }
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
