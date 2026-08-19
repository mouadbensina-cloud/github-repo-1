import type { CSSProperties } from "react";
import { Icon } from "@/components/ui/Icon";

/**
 * Shape of the "pick up where you left off" entry.
 *
 * Hard-coded at the call site for now; when the last-search endpoint exists this
 * is the only thing that needs to change — the component already renders from it.
 */
export type LastSearch = {
  /** Vertical that was searched, e.g. "Stays", "Flights", "Experiences". */
  category: string;
  destination: string;
  dateLabel: string;
  guestLabel: string;
  /**
   * Up to three thumbnails, back of the stack first. The last one is the card
   * that stays put; the two before it fan out on hover. Falls back to grey
   * placeholder swatches when omitted.
   */
  images?: string[];
};

/**
 * Figma ships this as seven stacked shadows rather than one — it keeps the card
 * edge crisp while the ambient falloff stays very soft.
 */
const CARD_SHADOW = [
  "0px 26.593px 56.627px 0px rgba(0,0,0,0.01)",
  "0px 12.295px 26.18px 0px rgba(0,0,0,0.01)",
  "0px 7.035px 14.98px 0px rgba(0,0,0,0.02)",
  "0px 4.27px 9.093px 0px rgba(0,0,0,0.02)",
  "0px 2.573px 5.479px 0px rgba(0,0,0,0.03)",
  "0px 1.433px 3.051px 0px rgba(0,0,0,0.03)",
  "0px 0.616px 1.312px 0px rgba(0,0,0,0.04)",
].join(", ");

/** Stand-ins until real thumbnails land — back, middle, front. */
const PLACEHOLDER_SHADES = ["#d4d7dc", "#b0b6bf", "#868e99"];

/**
 * Fan geometry, read straight off the two Figma frames.
 *
 * Both states reserve the same 58.693 x 50 wrapper, so nothing around the stack
 * reflows when it opens — only the two back cards move.
 */
const CARD_SIZE = 49.374;
const FAN_X = 7.5; // Figma: -7.655 / +7.345, symmetric to within a rounding error
const FAN_ANGLE = 10.7;

const FAN: Array<{ x: number; angle: number }> = [
  { x: -FAN_X, angle: -FAN_ANGLE },
  { x: FAN_X, angle: FAN_ANGLE },
  { x: 0, angle: 0 }, // front card holds its position
];

function CardStack({ images }: { images?: string[] }) {
  return (
    <div className="relative h-[50px] w-[58.693px] shrink-0">
      {FAN.map(({ x, angle }, i) => (
        <div
          key={i}
          className="absolute top-0 left-1/2 rounded-[9px] border-2 border-white bg-cover bg-center transition-transform duration-[380ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none group-hover:[transform:translateX(var(--fan-x))_rotate(var(--fan-angle))] group-focus-visible:[transform:translateX(var(--fan-x))_rotate(var(--fan-angle))]"
          style={
            {
              width: CARD_SIZE,
              height: CARD_SIZE,
              marginLeft: -CARD_SIZE / 2,
              boxShadow: CARD_SHADOW,
              backgroundColor: images?.[i]
                ? undefined
                : PLACEHOLDER_SHADES[i % PLACEHOLDER_SHADES.length],
              backgroundImage: images?.[i] ? `url(${images[i]})` : undefined,
              "--fan-x": `${x}px`,
              "--fan-angle": `${angle}deg`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

export function ContinueSearching({
  search,
  onSelect,
}: {
  search: LastSearch;
  onSelect?: () => void;
}) {
  const { category, destination, dateLabel, guestLabel, images } = search;
  const title = `Continue searching for ${category} in ${destination}`;
  const meta = `${dateLabel} . ${guestLabel}`;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={`${title}, ${meta}`}
      className="group flex max-w-full cursor-pointer flex-wrap items-center justify-center gap-4 rounded-[16px] px-2 py-1 outline-none focus-visible:ring-2 focus-visible:ring-brand/40 sm:flex-nowrap sm:gap-[32px]"
    >
      {/* Single line at the design width; below that it wraps rather than
          bleeding off the viewport, where it would be unreachable. */}
      <span className="flex flex-wrap items-center justify-center gap-[12px]">
        <span className="font-display text-[18px] font-bold tracking-[-0.18px] text-neutral-900 capitalize sm:whitespace-nowrap">
          {title}
        </span>
        <span className="font-display text-[18px] tracking-[-0.18px] text-neutral-900 capitalize sm:whitespace-nowrap">
          {meta}
        </span>
        {/* Hover widens the gap after the date from 12px to 20px in Figma, which
            reads as the chevron nudging forward. */}
        <span className="flex h-[10px] w-[5px] shrink-0 items-center justify-center text-neutral-500 transition-transform duration-[380ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-[8px] group-focus-visible:translate-x-[8px] motion-reduce:transition-none">
          <Icon
            name="chevron"
            size={10}
            style={{ height: 5.7143, transform: "rotate(-90deg)" }}
          />
        </span>
      </span>

      <CardStack images={images} />
    </button>
  );
}
