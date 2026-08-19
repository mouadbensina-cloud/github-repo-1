import type { CSSProperties } from "react";

/**
 * Geometry of the dot-map tile in `public/patterns/world-dots-tile.svg`.
 *
 * The Figma `Union` layer (1894.43 x 304) is this tile laid down three times at
 * a pitch of 643.3169px. Keeping one tile and repeating it in CSS gives an
 * endless loop instead of a strip that runs out.
 */
export const WORLD_TILE_WIDTH = 643.3169;
export const WORLD_TILE_HEIGHT = 304.002;

/**
 * The rotating dot-map. Sits behind the hero content and is revealed only
 * through the spotlight mask driven by `useSpotlight` on the parent.
 */
export function WorldBackdrop({
  /** Seconds for one full tile to travel — the perceived rotation speed. */
  durationSeconds = 90,
  /** Dot opacity. 0.34 matches the Figma frame; raise it for a bolder map. */
  opacity = 0.34,
  ink = "#000100",
}: {
  durationSeconds?: number;
  opacity?: number;
  ink?: string;
}) {
  return (
    <div
      className="world-viewport"
      style={
        {
          "--world-tile": "url(/patterns/world-dots-tile.svg)",
          "--world-tile-w": `${WORLD_TILE_WIDTH}px`,
          "--world-tile-h": `${WORLD_TILE_HEIGHT}px`,
          "--world-duration": `${durationSeconds}s`,
          "--world-opacity": opacity,
          "--world-ink": ink,
        } as CSSProperties
      }
    >
      <div className="world-rail">
        <div className="world-track" />
      </div>
    </div>
  );
}
