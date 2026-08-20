import { NextRequest, NextResponse } from "next/server";
import {
  searchPlaces,
  searchHotelRates,
  type LiteApiHotelDetails,
  type LiteApiHotelRates,
} from "@/lib/liteapi";
import { hotelHref } from "@/lib/hotel-params";
import { toLiteApiOccupancies, type GuestRoom } from "@/lib/search-params";
import { defaultStayParams } from "@/lib/explore-locations";

export type ChatHotel = {
  id: string;
  name: string;
  stars: number;
  image?: string;
  price: string;
  address: string;
  rating: string;
  href: string;
};

export type ChatResponse = {
  message: string;
  hotels?: ChatHotel[];
  searchUrl?: string;
};

type IncomingMessage = { role: "user" | "assistant"; content: string };

const COHERE_URL = "https://api.cohere.com/v2/chat";
const DEFAULT_ROOMS: GuestRoom[] = [{ adults: 2, childAges: [] }];

const SYSTEM_PROMPT = `You are Luminous AI, the friendly travel assistant for Luminous — a premium hotel booking platform.

Rules:
- When users ask about hotels, accommodations, or places to stay, ALWAYS use the search_hotels tool to find real results.
- After getting hotel results, write a SHORT intro (1-2 sentences) about the destination. Do NOT list hotel names, prices, or details in your text — the hotels appear as interactive cards the user can click.
- If no hotels are found, say so and suggest alternatives.
- If the user asks something unrelated to travel or hotels, politely redirect them.
- Keep responses concise, warm, and conversational.
- When users want to compare many options or browse extensively, mention they can explore more on the full search page.`;

const TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "search_hotels",
      description:
        "Search for real hotels with live pricing in a specific destination. Use whenever the user asks about hotels, accommodations, or places to stay.",
      parameters: {
        type: "object" as const,
        properties: {
          destination: {
            type: "string" as const,
            description:
              "The city or place name to search (e.g. 'Paris', 'Tokyo', 'Marrakech')",
          },
          min_stars: {
            type: "integer" as const,
            description: "Minimum star rating filter (1-5)",
          },
        },
        required: ["destination"],
      },
    },
  },
];

function pickCityPlace(
  places: { placeId: string; displayName: string; types?: string[] }[],
) {
  return (
    places.find(
      (p) =>
        p.types?.includes("locality") ||
        p.types?.includes("administrative_area_level_1"),
    ) ?? places[0]
  );
}

function nightsBetween(checkin: string, checkout: string): number {
  const ms = new Date(checkout).getTime() - new Date(checkin).getTime();
  return Math.max(1, Math.round(ms / 86_400_000));
}

function mapHotel(
  entry: LiteApiHotelRates,
  details: LiteApiHotelDetails | undefined,
  ctx: {
    placeId: string;
    placeName: string;
    checkin: string;
    checkout: string;
    nights: number;
    minStars?: number;
  },
): ChatHotel | null {
  if (!details) return null;
  if (ctx.minStars && (details.stars ?? 0) < ctx.minStars) return null;

  const image = details.main_photo || details.thumbnail;
  if (!image) return null;

  let cheapest = entry.roomTypes[0];
  for (const rt of entry.roomTypes) {
    if (rt.offerRetailRate.amount < cheapest.offerRetailRate.amount)
      cheapest = rt;
  }
  if (!cheapest) return null;

  return {
    id: details.id,
    name: details.name,
    stars: details.stars ?? 0,
    image,
    price: new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: cheapest.offerRetailRate.currency || "USD",
      maximumFractionDigits: 0,
    }).format(cheapest.offerRetailRate.amount),
    address: details.address ?? "",
    rating: details.rating ? details.rating.toFixed(1) : "",
    href: hotelHref(details.id, {
      stay: { checkin: ctx.checkin, checkout: ctx.checkout, rooms: DEFAULT_ROOMS },
      place: { id: ctx.placeId, name: ctx.placeName, kind: "city" },
    }),
  };
}

async function executeSearchHotels(args: {
  destination: string;
  min_stars?: number;
}): Promise<{ hotels: ChatHotel[]; searchUrl: string }> {
  const places = await searchPlaces(args.destination, { timeoutMs: 5000 });
  const place = pickCityPlace(places);
  if (!place) return { hotels: [], searchUrl: "" };

  const { checkin, checkout } = defaultStayParams();
  const nights = nightsBetween(checkin, checkout);

  const result = await searchHotelRates({
    placeId: place.placeId,
    checkin,
    checkout,
    occupancies: toLiteApiOccupancies(DEFAULT_ROOMS),
    guestNationality: "US",
    currency: "USD",
    maxRatesPerHotel: 1,
    limit: 100,
    timeoutMs: 10000,
  });

  const detailsById = new Map(result.hotels.map((h) => [h.id, h]));
  const ctx = {
    placeId: place.placeId,
    placeName: place.displayName,
    checkin,
    checkout,
    nights,
    minStars: args.min_stars,
  };

  const hotels = result.data
    .map((entry) => mapHotel(entry, detailsById.get(entry.hotelId), ctx))
    .filter((h): h is ChatHotel => h !== null)
    .slice(0, 6);

  const searchUrl =
    `/search?placeId=${encodeURIComponent(place.placeId)}` +
    `&place=${encodeURIComponent(place.displayName)}` +
    `&placeKind=city&checkin=${checkin}&checkout=${checkout}&occupancy=2`;

  return { hotels, searchUrl };
}

export async function POST(request: NextRequest) {
  const cohereKey = process.env.COHERE_API_KEY;
  if (!cohereKey) {
    return NextResponse.json(
      { message: "Chat is not configured yet." } satisfies ChatResponse,
      { status: 500 },
    );
  }

  let body: { messages: IncomingMessage[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { message: "Invalid request." } satisfies ChatResponse,
      { status: 400 },
    );
  }

  const { messages } = body;
  if (!messages?.length) {
    return NextResponse.json(
      { message: "No messages provided." } satisfies ChatResponse,
      { status: 400 },
    );
  }

  const cohereMessages: Record<string, unknown>[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  try {
    let res = await fetch(COHERE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cohereKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "command-r-plus-08-2024",
        messages: cohereMessages,
        tools: TOOLS,
        temperature: 0.3,
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("Cohere error:", res.status, detail);
      return NextResponse.json(
        {
          message: "Sorry, I'm having trouble thinking right now. Try again in a moment.",
        } satisfies ChatResponse,
        { status: 502 },
      );
    }

    let data = await res.json();
    let hotels: ChatHotel[] = [];
    let searchUrl: string | undefined;

    if (data.finish_reason === "TOOL_CALL" && data.message?.tool_calls?.length) {
      const toolCall = data.message.tool_calls[0];

      if (toolCall.function?.name === "search_hotels") {
        let args: { destination: string; min_stars?: number };
        try {
          args = JSON.parse(toolCall.function.arguments);
        } catch {
          args = { destination: messages[messages.length - 1].content };
        }

        try {
          const result = await executeSearchHotels(args);
          hotels = result.hotels;
          searchUrl = result.searchUrl;
        } catch (err) {
          console.error("Hotel search failed:", err);
        }

        const toolMessages = [
          ...cohereMessages,
          {
            role: "assistant",
            tool_calls: data.message.tool_calls,
            tool_plan: data.message.tool_plan ?? "",
          },
          {
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify({
              found: hotels.length,
              destination: args.destination,
              hotels: hotels.map((h) => ({
                name: h.name,
                stars: h.stars,
                price: h.price,
                address: h.address,
                rating: h.rating,
              })),
            }),
          },
        ];

        res = await fetch(COHERE_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${cohereKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "command-r-plus-08-2024",
            messages: toolMessages,
            temperature: 0.3,
          }),
        });

        if (!res.ok) {
          console.error("Cohere tool-response error:", res.status);
          return NextResponse.json({
            message: hotels.length
              ? `Here are some hotels I found in ${args.destination}:`
              : `I couldn't find available hotels in ${args.destination} right now. Try a different destination or check back later.`,
            hotels: hotels.length ? hotels : undefined,
            searchUrl,
          } satisfies ChatResponse);
        }

        data = await res.json();
      }
    }

    const content = data.message?.content;
    let text = "";
    if (Array.isArray(content)) {
      text = content.map((c: { text?: string }) => c.text ?? "").join("");
    } else if (typeof content === "string") {
      text = content;
    }

    if (!text && hotels.length) {
      text = "Here are some hotels I found for you:";
    } else if (!text) {
      text = "I'm not sure how to help with that. Try asking me about hotels or travel destinations!";
    }

    return NextResponse.json({
      message: text,
      hotels: hotels.length ? hotels : undefined,
      searchUrl,
    } satisfies ChatResponse);
  } catch (err) {
    console.error("Chat route error:", err);
    return NextResponse.json(
      {
        message: "Something went wrong. Please try again.",
      } satisfies ChatResponse,
      { status: 500 },
    );
  }
}
