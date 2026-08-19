import { Icon } from "@/components/ui/Icon";
import { imageStyle } from "@/components/ui/placeholder";
import type { Hotel } from "@/lib/search-data";

/**
 * The compact card a map popup shows for a clicked price pin (Figma
 * 33166:238867). Deliberately narrower and lighter than HotelCard — a map
 * popup competes with the map itself for space, so it drops the carousel
 * arrows/dots and swaps the full room-details block for one summary line.
 */
export function MapHotelCard({ hotel }: { hotel: Hotel }) {
  const {
    id,
    name,
    image,
    stars,
    address,
    roomsSummary,
    price,
    priceNote,
    freeCancellation,
  } = hotel;

  return (
    <article className="flex w-[314px] flex-col gap-3 rounded-[26px] bg-white p-1 pb-[18px]">
      <div
        className="relative h-[199px] w-full rounded-[22px] bg-cover bg-center"
        style={imageStyle(image, id)}
      >
        <button
          type="button"
          aria-label={`Save ${name}`}
          className="absolute top-[10px] right-[10px] flex size-[30px] cursor-pointer items-center justify-center rounded-full border border-white/35 bg-black/30 text-white backdrop-blur-[4.5px] transition-colors hover:bg-black/45"
        >
          <Icon name="heart" size={14} style={{ height: 12.4 }} />
        </button>
      </div>

      <div className="flex flex-col gap-2.5 px-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5">
            <span className="flex shrink-0 items-center gap-[2px] text-neutral-900">
              <Icon name="star" size={12.4} style={{ height: 11.9 }} />
              <span className="font-display text-[14px] font-bold">
                {stars}
              </span>
            </span>
            <Icon name="dot" size={4} className="shrink-0 text-neutral-400" />
            <h3 className="min-w-0 flex-1 truncate font-display text-[16px] font-bold text-neutral-900">
              {name}
            </h3>
          </div>
          <p className="truncate font-display text-[14px] tracking-[-0.14px] text-[#4d5761]">
            {address}
          </p>
          {roomsSummary ? (
            <p className="truncate font-display text-[14px] tracking-[-0.14px] text-[#4d5761]">
              {roomsSummary}
            </p>
          ) : null}
        </div>

        <div className="flex items-end justify-between gap-2">
          <div className="flex items-baseline gap-1.5">
            <span className="font-display text-[18px] font-semibold whitespace-nowrap text-neutral-900 underline">
              {price}
            </span>
            <span className="font-display text-[14px] tracking-[-0.14px] whitespace-nowrap text-[#4d5761]">
              {priceNote}
            </span>
          </div>
          {freeCancellation ? (
            <span className="shrink-0 rounded-[6px] bg-[#e6f6e9]/75 px-1 py-[2.5px] font-display text-[12px] font-medium tracking-[-0.24px] whitespace-nowrap text-[#038026]">
              Free cancellation
            </span>
          ) : null}
        </div>
      </div>
    </article>
  );
}
