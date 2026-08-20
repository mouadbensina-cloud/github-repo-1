"use client";

import { Icon, type IconName } from "@/components/ui/Icon";
import { SectionTitle } from "./HotelOverview";
import type { HotelReview, ReviewSummary } from "@/lib/hotel-data";

/**
 * Score badges are coloured by the score they carry rather than painted green
 * throughout. A live sample returned reviews at 1.0 and 3.0 beside a 10.0,
 * and a uniform green badge made "No air con in heat wave" read at a glance
 * as a positive review — the colour was contradicting the text next to it.
 */
function scoreColor(score: string | undefined): string {
  const value = Number(score);
  if (!Number.isFinite(value)) return "bg-neutral-500";
  // Thresholds deliberately line up with the word beside them (see
  // RATING_LABELS): green starts where the label reads "Very good", so a
  // badge is never a different verdict from its own caption.
  if (value >= 7) return "bg-[#15a233]";
  if (value >= 5) return "bg-[#b45309]";
  return "bg-[#c2410c]";
}

/**
 * The score breakdown and a strip of recent reviews.
 *
 * The two halves render as ONE continuous card, not two separate boxes: a
 * shared border wraps both, only the top (score) half is tinted `#f9fafb`
 * while the bottom (reviews) half is white — the seam is a background-colour
 * change, not a gap. Matches Figma's own split (Frame 2147228218 /
 * 33370:246673 for the tinted top, Reviews / 33370:246302 for the white
 * bottom) rather than the bordered-pair-of-cards look a naive read of "two
 * sections" would produce.
 *
 * The whole section is conditional on there being real data — see the
 * caller, which renders nothing at all (not even the heading or its divider)
 * when `summary` is null. Within it, each part hides independently:
 *
 *   - a category the API didn't return simply isn't in the row; nothing is
 *     padded to a fixed seven
 *   - the review strip disappears when no review had quotable text, while the
 *     score breakdown above it stays
 *
 * The two halves come from DIFFERENT endpoints (/data/hotel's
 * sentiment_analysis for the scores, /data/reviews for the cards), which is
 * why they can be present independently in the first place.
 */
export function ReviewHighlights({
  summary,
  reviews,
  totalReviews,
}: {
  summary: ReviewSummary;
  reviews: HotelReview[];
  totalReviews: number;
}) {
  return (
    <section className="flex flex-col gap-6">
      <SectionTitle>Review highlights</SectionTitle>

      <div className="flex flex-col overflow-hidden rounded-[24px] border border-[#f2f3f5]">
        <div className="flex flex-col gap-6 bg-[#f9fafb] p-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex h-[118px] flex-col items-start justify-between">
              <span
                className={`flex size-14 items-center justify-center rounded-tl-[56px] rounded-tr-[13.5px] rounded-br-[56px] rounded-bl-[56px] font-display text-[20px] font-bold tracking-[0.1px] text-white ${scoreColor(summary.score)}`}
              >
                {summary.score}
              </span>
              <span className="flex flex-col items-start gap-1">
                <span className="font-display text-[15px] font-bold tracking-[-0.15px] text-neutral-800">
                  {summary.label}
                </span>
                <span className="text-[13px] tracking-[-0.26px] text-neutral-500">
                  {summary.countLabel}
                </span>
              </span>
            </div>

            <span aria-hidden className="h-[70px] w-px shrink-0 bg-neutral-200" />

            <ul className="flex flex-1 flex-wrap items-center gap-x-4 gap-y-4">
              {summary.categories.map((category) => (
                <li
                  key={category.label}
                  className="flex h-[118px] flex-1 flex-col items-start justify-between"
                  // The API's own sentence for this score — surfaced as a
                  // tooltip rather than dropped, since it is the only thing
                  // that explains why the number is what it is.
                  title={category.description || undefined}
                >
                  <span className="flex size-14 items-center justify-center rounded-[12px] border border-[#d2d6db] bg-white">
                    <Icon name={category.icon as IconName} size={24} />
                  </span>
                  <span className="flex flex-col items-start gap-[2px]">
                    <span className="text-[13px] tracking-[-0.13px] text-neutral-800">
                      {category.label}
                    </span>
                    <span className="font-display text-[16px] font-medium tracking-[-0.16px] text-[#0d121c]">
                      {category.score}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {reviews.length > 0 ? (
          <div className="flex flex-col gap-4 bg-white p-6">
            <div className="flex flex-wrap items-center justify-end gap-[10px]">
              <FilterButton label="All rooms" />
              <FilterButton label="Newest first" />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {reviews.map((review) => (
                <ReviewCard key={review.id} review={review} />
              ))}
            </div>

            <button
              type="button"
              className="w-fit cursor-pointer rounded-[100px] border border-neutral-200 bg-white px-[14px] py-[9px] font-display text-[14px] font-medium tracking-[-0.112px] text-[#0d121c] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] transition-colors hover:bg-surface focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none"
            >
              See all {totalReviews.toLocaleString()} reviews
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

/** Inert by design — sorting and filtering aren't wired up yet, but the
 * controls stay real buttons so they're focusable and in the tab order. */
function FilterButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      className="flex cursor-pointer items-center gap-1 rounded-[10px] border border-neutral-200 bg-white py-2 pr-1.5 pl-3.5 font-display text-[14px] font-medium tracking-[-0.14px] text-neutral-900 shadow-[0px_1px_1px_0px_rgba(13,13,18,0.06)] transition-colors hover:bg-surface focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none"
    >
      {label}
      <Icon name="chevron-down" size={24} className="text-neutral-500" />
    </button>
  );
}

function ReviewCard({ review }: { review: HotelReview }) {
  return (
    <article className="flex flex-col gap-[10px] rounded-[10px] border-[1.5px] border-[#f2f3f5] p-5 shadow-[0px_2px_2px_0px_rgba(27,28,29,0.04)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-[6px]">
          <p className="truncate font-display text-[16px] font-bold text-neutral-900">
            {review.author}
          </p>
          {review.travellerType ? (
            <>
              <Icon name="dot" size={4} className="shrink-0 text-neutral-400" />
              <p className="truncate font-display text-[14px] font-medium text-neutral-500">
                {review.travellerType}
              </p>
            </>
          ) : null}
        </div>

        {review.score ? (
          <div className="flex shrink-0 items-center gap-2">
            <span
              className={`flex size-5 items-center justify-center rounded-tl-[56px] rounded-tr-[9px] rounded-br-[56px] rounded-bl-[56px] text-[12px] font-bold text-white ${scoreColor(review.score)}`}
            >
              {Math.round(Number(review.score))}
            </span>
            <span className="font-display text-[14px] font-medium tracking-[-0.14px] text-neutral-900">
              {review.scoreLabel}
            </span>
          </div>
        ) : null}
      </div>

      {review.dateLabel ? (
        <p className="font-display text-[14px] font-medium text-neutral-500">
          {review.dateLabel}
        </p>
      ) : null}

      {/* Reviews arrive in whatever language they were written in (es, it, fr
          and en all appeared in one live sample), so each carries its own lang
          for screen readers rather than inheriting the page's. "Show More" is
          purely visual for now (same "inert until the modal lands" contract
          as this section's other controls) — it rides along inside the
          line-clamp rather than a separate element below it, so it only ever
          shows where the design puts it: trailing the last visible line. */}
      <p lang={review.language} className="line-clamp-3 text-[16px] leading-[24px] text-neutral-500">
        {review.body}{" "}
        <span className="text-brand underline underline-offset-2">Show More</span>
      </p>
    </article>
  );
}
