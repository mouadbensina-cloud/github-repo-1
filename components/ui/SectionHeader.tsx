import { Icon } from "./Icon";

/**
 * Section title with the optional prev/next pair on the right.
 *
 * Figma builds both arrows from one chevron-down asset: the "next" button
 * rotates it -90deg, and "prev" is that same glyph mirrored — which is just
 * +90deg, so there's no need for a second asset or a flip wrapper.
 */
export function SectionHeader({
  title,
  onPrev,
  onNext,
  prevDisabled,
  nextDisabled,
}: {
  title: string;
  onPrev?: () => void;
  onNext?: () => void;
  prevDisabled?: boolean;
  nextDisabled?: boolean;
}) {
  const showArrows = Boolean(onPrev || onNext);

  return (
    <div className="flex items-center justify-between gap-4">
      <h2 className="font-display text-[28px] leading-tight font-bold text-neutral-800">
        {title}
      </h2>

      {showArrows && (
        <div className="flex shrink-0 items-center gap-[10px]">
          <ArrowButton
            label={`Previous ${title}`}
            rotate={90}
            onClick={onPrev}
            disabled={prevDisabled}
          />
          <ArrowButton
            label={`Next ${title}`}
            rotate={-90}
            onClick={onNext}
            disabled={nextDisabled}
          />
        </div>
      )}
    </div>
  );
}

function ArrowButton({
  label,
  rotate,
  onClick,
  disabled,
}: {
  label: string;
  rotate: number;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="flex size-9 cursor-pointer items-center justify-center rounded-[80px] bg-surface text-neutral-800 transition-[background-color,opacity] hover:bg-neutral-200 disabled:cursor-default disabled:opacity-40 disabled:hover:bg-surface"
    >
      <Icon name="chevron-down" size={20} style={{ rotate: `${rotate}deg` }} />
    </button>
  );
}
