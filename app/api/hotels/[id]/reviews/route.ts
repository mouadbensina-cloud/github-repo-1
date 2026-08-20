import { NextResponse } from "next/server";
import { getHotelReviews, LiteApiError } from "@/lib/liteapi";
import { mapReviews } from "@/lib/hotel-data";

/**
 * GET /api/hotels/:id/reviews — the individual review cards.
 *
 * Only the CARDS. The score badge and the per-category breakdown beside them
 * come from /data/hotel's sentiment_analysis, which /api/hotels/:id already
 * returns — the identical object is available here as `sentimentAnalysis`,
 * but taking it from the detail call means the whole review header renders
 * with the rest of the page instead of waiting on a second request.
 *
 * Over-fetches deliberately: reviews arrive in mixed languages and some carry
 * no quotable text at all (headline "" with empty pros/cons), both of which
 * mapReviews drops, so asking for exactly the four the design shows would
 * routinely render two.
 */
const FETCH_LIMIT = 20;
const CARD_LIMIT = 4;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const response = await getHotelReviews(id, {
      limit: FETCH_LIMIT,
      next: { revalidate: 3600 },
    });

    const reviews = mapReviews(response.data, CARD_LIMIT);

    return NextResponse.json({
      reviews,
      // The real corpus size (12,148 on a live sample), not the page length —
      // this is what "See all reviews" and the count line report.
      total: response.total ?? 0,
    });
  } catch (error) {
    // A hotel with no reviews is not a page error: the section simply hides
    // itself, so this answers with an empty set rather than a status the
    // page would have to special-case into "no reviews" anyway.
    if (error instanceof LiteApiError && error.status === 404) {
      return NextResponse.json({ reviews: [], total: 0 });
    }
    if (error instanceof LiteApiError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status ?? 502 },
      );
    }
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
