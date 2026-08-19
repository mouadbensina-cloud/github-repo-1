"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

/**
 * Positions a dropdown panel below the trip-selector row and portals it to
 * document.body. It has to be a portal rather than a plain `absolute` child
 * of the row: `.hero-card` (the whole hero) has `overflow-hidden` for the
 * spotlight/world-map backdrop, and the hero is only ~304px tall at rest —
 * nowhere near enough to contain a calendar without clipping it. Rendering
 * outside that subtree via a portal, with position computed from the row's
 * own getBoundingClientRect(), sidesteps the clip entirely.
 *
 * One persistent panel is meant to be reused across Where/When/Who (see
 * SearchPanel) rather than mounting a fresh instance per field, so it can
 * morph smoothly instead of popping between three separate boxes — see
 * .trip-dropdown-panel. Both `left` and `right` alignment always resolve to
 * a plain `left` pixel value here (never a `right` style), so switching
 * alignment mid-transition is just one more number for the CSS transition
 * to interpolate rather than a discontinuity.
 *
 * Size and position are read off the *content* wrapper, not the panel
 * itself: the panel's own box is what we're animating (via explicit
 * width/height), so measuring the panel would just read back whatever we
 * last set. A ResizeObserver on the content — rather than a one-shot
 * measurement keyed on the active field — means any content-only size
 * change (e.g. WhoDropdown growing when a room is added, with the field
 * selection unchanged) still resizes the panel smoothly instead of clipping
 * or leaving dead space.
 */
export function FieldDropdownPortal({
  anchorRef,
  align,
  onClose,
  className = "",
  children,
}: {
  anchorRef: React.RefObject<HTMLElement | null>;
  align: "left" | "right";
  onClose: () => void;
  className?: string;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<CSSProperties>({ visibility: "hidden" });

  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    const content = contentRef.current;
    if (!anchor || !content) return;

    const measure = () => {
      const anchorRect = anchor.getBoundingClientRect();
      const contentRect = content.getBoundingClientRect();
      const gap = 12;
      setStyle({
        position: "fixed",
        top: anchorRect.bottom + gap,
        left:
          align === "left"
            ? anchorRect.left
            : anchorRect.right - contentRect.width,
        width: contentRect.width,
        height: contentRect.height,
      });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(content);
    return () => observer.disconnect();
  }, [anchorRef, align]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onClose();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [anchorRef, onClose]);

  return createPortal(
    <div
      ref={panelRef}
      style={{ ...style, zIndex: 60, overflow: "hidden" }}
      className={`trip-dropdown-panel rounded-[24px] border border-neutral-200 bg-white shadow-[0px_16px_32px_-12px_rgba(88,92,95,0.1)] ${className}`}
    >
      <div ref={contentRef} className="w-fit">
        {children}
      </div>
    </div>,
    document.body,
  );
}
