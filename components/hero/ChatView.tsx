import { Icon } from "@/components/ui/Icon";

/**
 * The fullscreen chat layout the hero morphs into (point B of the Ask AI ->
 * Enter animation, Figma 33160:232154). Static for now — a hardcoded example
 * exchange, no wiring to an actual model yet.
 *
 * Constrained to the same 876px column the search panel itself occupies —
 * not the full hero-card width. Logo and auth actions are siblings outside
 * this component entirely and never move; only the search column's own
 * contents (mode tabs + field) cross-fade with this.
 */
export function ChatView({
  open,
  onBack,
}: {
  open: boolean;
  onBack: () => void;
}) {
  return (
    <div
      data-show={open}
      inert={!open}
      className="hero-chat-view absolute inset-0 flex h-full flex-col justify-between"
    >
      <button
        type="button"
        onClick={onBack}
        className="flex w-fit shrink-0 cursor-pointer items-center gap-3 font-display text-[16px] text-neutral-600 tracking-[-0.32px]"
      >
        <span className="flex size-8 items-center justify-center rounded-full border border-neutral-200 bg-white">
          <Icon name="chevron" size={11.7} style={{ height: 6.7, rotate: "90deg" }} />
        </span>
        Back
      </button>

      <div className="flex flex-col items-end gap-6">
        <p className="max-w-[70%] rounded-tl-[16px] rounded-tr-[16px] rounded-br-[6px] rounded-bl-[16px] bg-neutral-500 px-3.5 py-2.5 font-display text-[16px] text-white tracking-[-0.32px]">
          Give me hotels in Marrakech
        </p>
        <p className="font-display text-[16px] leading-[23px] tracking-[-0.32px] text-[#384250]">
          Marrakech offers a diverse range of accommodations, from luxurious
          5-star resorts with expansive pools to traditional, budget-friendly
          riads right next to the historic Jemaa el-Fnaa square. Below is an
          overview of top-rated hotels in the city categorized by style and
          budget
        </p>

        {/* Same outer chrome as the search field (p-2/rounded-30 wrapping a
            border/shadow/rounded-24 inner box) — a column instead of a row,
            since the placeholder needs its own line above the icons. */}
        <div className="w-full rounded-[30px] bg-white p-2 drop-shadow-[0px_15px_10px_rgba(0,0,0,0.03)]">
          <div className="flex w-full flex-col items-end gap-4 rounded-[24px] border border-neutral-200 bg-white py-4 pr-2 pl-6 shadow-[0px_15px_20px_0px_rgba(0,0,0,0.03)]">
            <span className="w-full truncate text-[14px] font-medium tracking-[-0.28px] text-neutral-400">
              e.g. 5-star hotels in Paris next weekend with breakfast
            </span>
            <div className="flex shrink-0 items-center gap-2.5">
              <button
                type="button"
                aria-label="Search by voice"
                className="flex size-10 items-center justify-center rounded-[16px] text-neutral-900 transition-colors hover:bg-neutral-200/60"
              >
                <Icon name="mic" />
              </button>
              <button
                type="button"
                aria-label="Send"
                className="flex size-10 items-center justify-center rounded-[16px] bg-brand text-white transition-opacity hover:opacity-90"
              >
                <Icon name="arrow-right" size={20} style={{ rotate: "-90deg" }} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
