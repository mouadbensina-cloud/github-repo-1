"use client";

import { useCallback, useEffect, useRef } from "react";

type SpotlightHandlers = {
  onPointerMove: (event: React.PointerEvent<HTMLElement>) => void;
  onPointerLeave: () => void;
};

/**
 * Tracks the pointer over a container and publishes its position as CSS custom
 * properties (`--spot-x` / `--spot-y`) plus an on/off flag that CSS turns into
 * the reveal radius.
 *
 * Writing custom properties rather than re-rendering keeps this off React's
 * critical path, and coalescing into a single rAF means at most one style write
 * per frame no matter how fast the pointer fires.
 */
export function useSpotlight<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const frame = useRef<number | null>(null);
  const pending = useRef<{ x: number; y: number } | null>(null);

  const flush = useCallback(() => {
    frame.current = null;
    const el = ref.current;
    const point = pending.current;
    if (!el || !point) return;
    el.style.setProperty("--spot-x", `${point.x}px`);
    el.style.setProperty("--spot-y", `${point.y}px`);
    el.dataset.spotlight = "on";
  }, []);

  const hide = useCallback(() => {
    if (frame.current !== null) {
      cancelAnimationFrame(frame.current);
      frame.current = null;
    }
    pending.current = null;
    const el = ref.current;
    if (el) delete el.dataset.spotlight;
  }, []);

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      // Coarse pointers get the static reveal defined in CSS instead.
      if (event.pointerType === "touch") return;
      const el = ref.current;
      if (!el) return;
      // Surfaces that sit on top of the backdrop (the search widget) opt out, so
      // the reveal doesn't chase the cursor behind content it can't show through.
      if ((event.target as Element | null)?.closest?.("[data-spotlight-block]")) {
        hide();
        return;
      }
      const rect = el.getBoundingClientRect();
      pending.current = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
      if (frame.current === null) {
        frame.current = requestAnimationFrame(flush);
      }
    },
    [flush, hide],
  );

  const onPointerLeave = hide;

  useEffect(() => {
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, []);

  const handlers: SpotlightHandlers = { onPointerMove, onPointerLeave };
  return { ref, handlers };
}
