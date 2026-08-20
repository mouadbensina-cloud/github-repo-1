import { NextResponse, type NextRequest } from "next/server";
import {
  getHotelDetail,
  searchHotelRates,
  LiteApiError,
  type LiteApiRoomType,
  type LiteApiStaticRoom,
} from "@/lib/liteapi";
import {
  cancellationBadge,
  mapRoomAmenities,
  matchStaticRoom,
  mealsBadge,
  roomPhotos,
  roomSizeLabel,
  ROOM_AMENITY_LIMIT,
  ROOM_GALLERY_LIMIT,
  type RoomOffer,
} from "@/lib/hotel-data";
import { parseStayParams } from "@/lib/hotel-params";
import { toLiteApiOccupancies } from "@/lib/search-params";

/**
 * GET /api/hotels/:id/rates?checkin=&checkout=&occupancy= — the bookable
 * offers for ONE hotel, mapped into the RoomOffer cards the page renders.
 *
 * Separate route from /api/hotels/:id on purpose. The two have genuinely
 * different lifetimes and failure modes: static content is cacheable for an
 * hour and is what the whole page waits on, while pricing is live, expires in
 * minutes, and must be allowed to fail on its own without taking the hotel's
 * name and photos down with it. Splitting them is what lets the page render
 * metadata immediately and degrade to a rooms-only error state.
 *
 * `maxRatesPerHotel` is high here, unlike the search route's 1: search needs
 * only the cheapest rate per hotel to print a "from" price, whereas this page
 * IS the list of every way to book this one hotel.
 */
const MAX_RATES = 50;

/**
 * Live pricing, so cached far more briefly than static content — just long
 * enough to absorb a dev-mode effect double-invoke, a quick back-navigation,
 * or the rates call being repeated when the sticky widget re-submits the same
 * unchanged criteria. Keyed by the full upstream request, so any change to
 * dates or occupancy still prices fresh.
 */
const RATES_REVALIDATE_SECONDS = 120;

function nightsBetween(checkin: string, checkout: string): number {
  const ms = new Date(`${checkout}T00:00:00Z`).getTime() -
    new Date(`${checkin}T00:00:00Z`).getTime();
  return Math.max(1, Math.round(ms / 86_400_000));
}

function money(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Everything a card actually SHOWS, except price — two offers that agree on
 * all of this are indistinguishable to a guest no matter how different their
 * rateIds or supplier are underneath.
 *
 * A live sample (Novotel Suites Paris CDG) had the exact same room name,
 * size and badges repeated 6+ times at different prices — evidently the same
 * inventory coming back through more than one channel — which rendered as a
 * wall of near-identical cards; dedupeOffers below collapses each such group
 * to its cheapest member.
 *
 * That's deliberately narrower than "same room name": another live sample
 * (ibis Styles Paris Bercy) had three "Standard Room with 1 double bed"
 * offers at $718 / $755 / $829, where the first two shared the SAME badges
 * (Non-refundable, Breakfast included) and only the price differed — so
 * those two collapse into the $718 card — while $829 was the genuinely
 * different refundable rate and keeps its own card. Two cards survive, not
 * one and not three; the badge match is what decides which.
 */
function offerIdentityKey(offer: RoomOffer): string {
  return [
    offer.name,
    offer.sizeLabel ?? "",
    offer.sleeps ?? "",
    offer.cancellation?.label ?? "",
    offer.meals.label,
  ].join("|");
}

/** Collapses offers that share an identity key down to the cheapest one. Map
 * insertion order is preserved for untouched keys, so this doesn't disturb
 * the eventual price sort beyond removing the duplicates. */
function dedupeOffers(offers: RoomOffer[]): RoomOffer[] {
  const cheapestByKey = new Map<string, RoomOffer>();

  for (const offer of offers) {
    const key = offerIdentityKey(offer);
    const existing = cheapestByKey.get(key);
    if (!existing || parseMoney(offer.price) < parseMoney(existing.price)) {
      cheapestByKey.set(key, offer);
    }
  }

  return [...cheapestByKey.values()];
}

/**
 * One card per bookable offer, not per physical room: a hotel can genuinely
 * offer the same room under different rate plans (see offerIdentityKey for
 * the refundability example that's kept as separate cards). Only EXACT
 * duplicates — same name, size, sleeps and badges — are collapsed, via
 * dedupeOffers below. Offers whose photo couldn't be matched are dropped
 * entirely at the end of this function, not just here — see the filter on
 * this function's return value.
 */
function mapRoomOffers(
  roomTypes: LiteApiRoomType[],
  staticRooms: LiteApiStaticRoom[] | undefined,
  context: { nights: number; roomCount: number; fallbackCurrency: string },
): RoomOffer[] {
  const offers: RoomOffer[] = [];

  for (const roomType of roomTypes) {
    // rates[] is the per-occupancy breakdown of one offer; its first entry
    // carries the board/cancellation terms that describe the whole offer.
    const rate = roomType.rates?.[0];
    if (!rate) continue;

    const total = roomType.offerRetailRate?.amount;
    if (!Number.isFinite(total)) continue;
    const currency = roomType.offerRetailRate?.currency || context.fallbackCurrency;

    // Only a genuine pre-discount price earns a strikethrough. On every live
    // sample initialPrice EQUALLED total (no promotion), which is precisely
    // why this is a strict `>` rather than "render it whenever it exists".
    const initial = rate.retailRate?.initialPrice?.[0]?.amount;
    const discounted = Number.isFinite(initial) && initial! > total!;

    const staticRoom = matchStaticRoom(rate.name ?? "", staticRooms);
    // One ordering shared by the card's single thumbnail and the detail
    // modal's 4-up grid, so the photo you click is the photo you land on.
    const photos = roomPhotos(staticRoom);

    const taxes = rate.retailRate?.taxesAndFees ?? [];
    const hasExcludedFees = taxes.some((fee) => !fee.included);

    offers.push({
      id: roomType.offerId || rate.rateId,
      name: rate.name?.trim() || staticRoom?.roomName?.trim() || "Room",
      sizeLabel: roomSizeLabel(staticRoom),
      // The RATE's own maxOccupancy, which is always present — unlike the
      // static room's, which requires a name match that often fails.
      sleeps: Number.isFinite(rate.maxOccupancy) ? rate.maxOccupancy : undefined,
      image: photos[0],
      images: photos.slice(0, ROOM_GALLERY_LIMIT),
      amenities: mapRoomAmenities(
        staticRoom?.roomAmenities?.map((amenity) => amenity.name),
      ).slice(0, ROOM_AMENITY_LIMIT),
      description: staticRoom?.description?.trim() || undefined,
      price: money(total!, currency),
      originalPrice: discounted ? money(initial!, currency) : undefined,
      priceNote: `${context.roomCount} room${context.roomCount === 1 ? "" : "s"} x ${context.nights} night${context.nights === 1 ? "" : "s"}, ${
        hasExcludedFees ? "excl. fees due at property" : "incl. taxes"
      }`,
      cancellation: cancellationBadge(rate),
      meals: mealsBadge(rate),
    });
  }

  return dedupeOffers(offers)
    // A card with no matched photo falls back to a flat grey block (see
    // matchStaticRoom's own doc comment on why that match can fail even for
    // a real, bookable rate — the API gives no join key between price and
    // room content, so this is a real gap in what LiteAPI returns, not a
    // bug). Dropping the offer entirely rather than showing that grey card
    // was a deliberate call: every offer left in the list is guaranteed to
    // render with a real room photo.
    .filter((offer) => Boolean(offer.image))
    .sort((a, b) => parseMoney(a.price) - parseMoney(b.price));
}

function parseMoney(value: string): number {
  return Number(value.replace(/[^0-9.]/g, "")) || 0;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const parsed = parseStayParams(request.nextUrl.searchParams);

  if (!parsed.ok) {
    // The page checks the same criteria with the same codec and simply
    // doesn't call this route until they're complete, so reaching here means
    // a hand-built request. 400 with the machine-readable reason rather than
    // pricing a guessed-at stay.
    return NextResponse.json(
      { error: "Incomplete stay criteria", reason: parsed.reason },
      { status: 400 },
    );
  }

  const { checkin, checkout, rooms } = parsed.stay;
  const currency = request.nextUrl.searchParams.get("currency") ?? "USD";
  const guestNationality =
    request.nextUrl.searchParams.get("guestNationality") ?? "US";

  try {
    // Run together: the rates call is the slow one, and the detail call is
    // almost always a Data Cache hit because /api/hotels/:id has already
    // made the identical request (same URL, same revalidate) — so this costs
    // essentially nothing while supplying the room sizes and photos that
    // /hotels/rates does not return at all.
    const [result, detail] = await Promise.all([
      searchHotelRates({
        hotelIds: [id],
        checkin,
        checkout,
        occupancies: toLiteApiOccupancies(rooms),
        currency,
        guestNationality,
        maxRatesPerHotel: MAX_RATES,
        next: { revalidate: RATES_REVALIDATE_SECONDS },
      }),
      getHotelDetail(id, { next: { revalidate: 3600 } }).catch(() => null),
    ]);

    const entry = result.data?.find((item) => item.hotelId === id) ?? result.data?.[0];
    const offers = entry
      ? mapRoomOffers(entry.roomTypes ?? [], detail?.rooms, {
          nights: nightsBetween(checkin, checkout),
          roomCount: rooms.length,
          fallbackCurrency: currency,
        })
      : [];

    return NextResponse.json({
      offers,
      // The "From $X" headline. Null rather than 0 when nothing is bookable,
      // so the widget hides the price instead of advertising a free stay.
      cheapest: offers.length ? offers[0].price : null,
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
