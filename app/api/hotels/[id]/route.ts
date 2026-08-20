import { NextResponse } from "next/server";
import { getHotelDetail, LiteApiError } from "@/lib/liteapi";
import { mapHotelDetail } from "@/lib/hotel-data";

/**
 * GET /api/hotels/:id — one hotel's static content, already reshaped into the
 * HotelDetail view model the details page renders (see lib/hotel-data.ts).
 *
 * Maps here rather than passing LiteAPI's payload through because the raw
 * response is ~40KB of which the page uses a fraction: 82 gallery images
 * where five are shown, 47 facilities where six are, plus rooms, policies and
 * points of interest the page never touches. Mapping server-side keeps that
 * off the wire entirely, and keeps the "hide what the API didn't return"
 * decisions in one testable place instead of scattered through JSX.
 *
 * Deliberately independent of the rates call: this is the request the page's
 * whole chrome waits on, so it must not be delayed by, or fail with, pricing.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    // Static content changes on the order of weeks, and a details page is
    // reloaded far more often than that — an hour of caching takes repeat
    // views, back-navigations and dev-mode double-invokes off the sandbox
    // key's rate limit entirely.
    const hotel = await getHotelDetail(id, { next: { revalidate: 3600 } });

    // LiteAPI answers 200 with an empty payload for an id that doesn't exist,
    // so "no data" is the 404 signal — the page renders its not-found state
    // off this rather than a generic failure.
    if (!hotel?.id) {
      return NextResponse.json(
        { error: "Hotel not found", reason: "not-found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ hotel: mapHotelDetail(hotel) });
  } catch (error) {
    if (error instanceof LiteApiError) {
      // An id LiteAPI doesn't recognise comes back as a 400, not a 404
      // (verified live: {"error":{"code":4002,"description":"hotelId is
      // missing or invalid"}}). Left as-is it would surface as a generic
      // "something went wrong" for what is really just a dead link, so it's
      // translated here into the not-found the page renders properly —
      // same treatment app/api/search/route.ts gives an invalid placeId.
      if (
        error.status === 404 ||
        (error.status === 400 && /hotelid/i.test(error.message))
      ) {
        return NextResponse.json(
          { error: "Hotel not found", reason: "not-found" },
          { status: 404 },
        );
      }
      return NextResponse.json(
        { error: error.message },
        { status: error.status ?? 502 },
      );
    }
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
