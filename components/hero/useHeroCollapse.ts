"use client";

import { useEffect, useRef, useState } from "react";

/** How far past the top counts as "started scrolling". Small on purpose —
 * this is a trigger, not a threshold to scrub through. It exists only to
 * absorb trackpad rubber-banding at the very top. */
const TRIGGER_PX = 4;

/**
 * Drives the hero -> collapsed-bar morph as a triggered transition, not a
 * scroll-scrubbed one: the moment the page scrolls past TRIGGER_PX this flips
 * --collapse-p from 0 to 1, and a single CSS transition on that one property
 * carries the whole morph. Further scrolling doesn't move it along; crossing
 * back near the top plays it in reverse.
 *
 * One property is the point. Every part of the hero — card height, field
 * width, tab strip, mode icon, Ask AI — derives from --collapse-p in CSS, so
 * they all share one clock and one easing curve. Nothing can arrive late
 * because there is only one thing being animated.
 *
 * There is only one hero: this morphs it in place from its expanded form to
 * the collapsed bar, rather than cross-fading two separate widgets.
 *
 * `collapsed` mirrors the flag as React state, only so AI mode can be stood
 * down and the tab strip taken out of the tab order.
 *
 * `force` pins the bar collapsed unconditionally (search results page: the
 * hero is a fixed 128px summary bar there, never the tall scroll-to-top
 * state) and skips the scroll listener entirely rather than just seeding it
 * collapsed, since scrolling back to the top would otherwise un-collapse it.
 */
export function useHeroCollapse<T extends HTMLElement>(force = false) {
  const ref = useRef<T>(null);
  const [collapsed, setCollapsed] = useState(force);

  useEffect(() => {
    const root = document.documentElement;

    if (force) {
      root.style.setProperty("--collapse-p", "1");
      setCollapsed(true);
      return;
    }

    let last = false;

    const apply = (next: boolean) => {
      if (next === last) return;
      last = next;
      root.style.setProperty("--collapse-p", next ? "1" : "0");
      setCollapsed(next);
    };

    let frame: number | null = null;
    const onScroll = () => {
      if (frame !== null) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        apply(window.scrollY > TRIGGER_PX);
      });
    };

    apply(window.scrollY > TRIGGER_PX);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [force]);

  return { ref, collapsed };
}
