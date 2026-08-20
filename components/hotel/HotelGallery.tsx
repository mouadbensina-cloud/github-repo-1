"use client";

import { Icon } from "@/components/ui/Icon";
import { imageStyle } from "@/components/ui/placeholder";

/**
 * One hero shot plus a 2x2 grid of thumbnails, with the picture count sitting
 * on the last tile.
 *
 * Nested rounding, matching Figma's "Images container" exactly: the OUTER
 * row clips to a 24px radius while each individual tile inside carries its
 * own, much smaller 8px radius — not one flat radius applied everywhere.
 *
 * Every degraded case is handled by simply rendering FEWER tiles rather than
 * by filling the grid with broken slots:
 *   0 images  -> a single full-width neutral block, no grid at all
 *   1 image   -> the hero alone, full width
 *   2-5       -> hero plus however many thumbnails exist, columns collapsing
 *                as needed
 *
 * The overlay only appears when there are genuinely more pictures than the
 * five on screen, so it never promises a gallery that is already fully shown.
 */
export function HotelGallery({
  images,
  total,
  hotelId,
}: {
  images: string[];
  /** The hotel's FULL picture count, which is what the overlay reports — the
   * `images` array is capped for payload size (see GALLERY_LIMIT). */
  total: number;
  /** Seeds the placeholder shade so an image-less hotel keeps one stable
   * colour instead of flickering between renders. */
  hotelId: string;
}) {
  const [hero, ...thumbs] = images;
  const hiddenCount = Math.max(0, total - images.length);
  // Figma lays the four thumbnails out as two fixed 244px columns of two,
  // not a single 2x2 grid — kept as two explicit columns so the same
  // structure survives down to 2 or 3 photos without a grid-track gap
  // appearing where a missing tile would have been.
  const columns = [thumbs.slice(0, 2), thumbs.slice(2, 4)];
  // Index of the very last rendered thumbnail across BOTH columns — not
  // "last column's last slot", which breaks the moment a column is
  // partially or fully empty (2-3 total photos leaves the second column
  // empty, so that check would never fire).
  const lastThumbIndex = thumbs.length - 1;

  if (!images.length) {
    return (
      <div
        className="h-[400px] w-full rounded-[24px]"
        style={imageStyle(undefined, hotelId)}
        role="img"
        aria-label="No photos available for this hotel"
      />
    );
  }

  return (
    <div className="flex h-[400px] items-center gap-[8px] overflow-clip rounded-[24px]">
      <div
        className="h-full flex-1 rounded-[8px] bg-cover bg-center"
        style={imageStyle(hero, hotelId)}
        role="img"
        aria-label="Hotel photo"
      />

      {columns.map((column, columnIndex) =>
        column.length > 0 ? (
          <div
            key={columnIndex}
            className="flex h-full w-[244px] shrink-0 flex-col gap-[8px]"
          >
            {column.map((image, index) => {
              const globalIndex = columnIndex * 2 + index;
              const showOverlay = globalIndex === lastThumbIndex && hiddenCount > 0;

              return (
                <div
                  key={`${image}-${index}`}
                  className="relative flex-1 overflow-hidden rounded-[8px] bg-cover bg-center"
                  style={imageStyle(image, `${hotelId}-${columnIndex}-${index}`)}
                  role="img"
                  aria-label="Hotel photo"
                >
                  {showOverlay ? (
                    <button
                      type="button"
                      className="absolute inset-0 flex cursor-pointer items-center justify-center rounded-[8px] bg-black/50 transition-colors hover:bg-black/60 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
                    >
                      <span className="flex w-[135px] flex-col items-center justify-center gap-[6px] drop-shadow-[0px_2px_2px_rgba(27,28,29,0.04)]">
                        <Icon name="images" size={24} className="text-white" />
                        <span className="font-display text-[12px] font-medium tracking-[-0.24px] whitespace-nowrap text-white">
                          Show All {total} Pictures
                        </span>
                      </span>
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : null,
      )}
    </div>
  );
}
