import { NextResponse } from "next/server";
import { getHotel, LiteApiError } from "@/lib/liteapi";

/**
 * GET /api/hotels/:id — proxies LiteAPI's GET /data/hotel?hotelId=:id.
 * Client code calls this route, never LiteAPI directly, so LITEAPI_KEY
 * never reaches the browser.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const hotel = await getHotel(id);
    return NextResponse.json(hotel);
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
