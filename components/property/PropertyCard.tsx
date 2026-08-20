import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { imageStyle } from "@/components/ui/placeholder";

export type Property = {
  id: string;
  name: string;
  stars: number;
  address: string;
  /** Not returned by every data source this card is fed from (LiteAPI's
   * rates search has no distance-from-center field) — the row hides itself
   * rather than show a fabricated value when this is absent. */
  distance?: string;
  price: string;
  priceUnit: string;
  reviews: string;
  /** Renders the translucent "Price dropped" pill over the photo. */
  badge?: string;
  image?: string;
  /** Where the card navigates — the hotel details page, when known. Renders
   * as a plain (non-interactive) card when omitted, same as CategoryGrid's
   * tiles. */
  href?: string;
};

export function PropertyCard({ property }: { property: Property }) {
  const {
    id,
    name,
    stars,
    address,
    distance,
    price,
    priceUnit,
    reviews,
    badge,
    image,
    href,
  } = property;

  return (
    <article className="relative flex flex-col overflow-hidden rounded-[20px] border border-[#d2d6db] bg-white">
      <div
        className="relative flex h-[208px] w-full items-start justify-between gap-2 bg-cover bg-center p-2"
        style={imageStyle(image, id)}
      >
        {badge ? (
          <span className="flex items-center justify-center rounded-[12px] border border-white/50 bg-white/80 px-2 py-1 font-display text-[12px] leading-5 tracking-[0.024px] text-[#1f1f1f] backdrop-blur-[7.5px]">
            {badge}
          </span>
        ) : (
          <span />
        )}

        {/* Sits ABOVE the card-covering Link below (relative + z-20 vs. its
            absolute + z-10) rather than nested inside it — this codebase
            already ruled out two overlapping link/button targets on one
            card once, in HotelCard, and a <button> inside an <a> is invalid
            HTML besides. */}
        <button
          type="button"
          aria-label={`Save ${name}`}
          className="relative z-20 flex size-[22px] shrink-0 cursor-pointer items-center justify-center rounded-lg border border-white/35 bg-black/30 p-1 text-white backdrop-blur-[4.5px] transition-colors hover:bg-black/45"
        >
          <Icon name="heart" size={12} style={{ height: 10.667 }} />
        </button>
      </div>

      <div className="flex flex-col gap-[10px] px-4 pt-2 pb-4">
        <div className="flex w-full items-center gap-[6px]">
          <span className="flex shrink-0 items-center gap-[3px] text-neutral-900">
            <Icon name="star" size={12.434} style={{ height: 11.903 }} />
            <span className="font-display text-[14px] leading-[18px] font-bold">
              {stars}
            </span>
          </span>
          <Icon name="dot" size={4} className="shrink-0 text-neutral-900" />
          <h3 className="min-w-0 flex-1 truncate font-display text-[16px] leading-5 font-bold text-neutral-900">
            {name}
          </h3>
        </div>

        <MetaRow icon="pin" text={address} />
        {distance && <MetaRow icon="walking" text={distance} />}

        <div className="flex w-full items-end justify-between gap-2 whitespace-nowrap">
          <div className="flex flex-col justify-center gap-[2px]">
            <div className="flex items-end gap-[6px]">
              <span className="font-display text-[22px] leading-[22px] font-bold tracking-[0.22px] text-neutral-900">
                {price}
              </span>
              <span className="font-display text-[13px] leading-4 text-[#4d5761]">
                {priceUnit}
              </span>
            </div>
            <span className="font-display text-[13px] leading-4 text-[#4d5761]">
              Includes taxes &amp; fees
            </span>
          </div>
          <span className="font-display text-[14px] leading-[18px] text-[#4d5761]">
            {reviews}
          </span>
        </div>
      </div>

      {href && (
        <Link href={href} aria-label={name} className="absolute inset-0 z-10">
          <span className="sr-only">{name}</span>
        </Link>
      )}
    </article>
  );
}

function MetaRow({ icon, text }: { icon: "pin" | "walking"; text: string }) {
  return (
    <div className="flex items-center gap-1 text-[#4d5761]">
      <Icon name={icon} size={16} />
      <span className="truncate font-display text-[14px] leading-[18px]">
        {text}
      </span>
    </div>
  );
}
