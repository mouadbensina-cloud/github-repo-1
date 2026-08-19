"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/ui/Icon";
import { SearchPanel } from "./SearchPanel";
import { WorldBackdrop } from "./WorldBackdrop";
import { useHeroChat } from "./useHeroChat";
import { useHeroCollapse } from "./useHeroCollapse";
import { useSpotlight } from "./useSpotlight";
import type { SearchCriteria } from "@/lib/search-params";

/**
 * The hero, which is also the site header. It morphs in place between three
 * states, never cross-fading a second widget on top of itself:
 *
 *  - full search panel (scrolled to top)
 *  - compact sticky bar (scrolled down — see useHeroCollapse)
 *  - fullscreen chat (Ask AI -> Enter — see useHeroChat)
 *
 * `hero-shell` stays in flow, reserving whatever height the current state
 * needs, so nothing below it ever jumps; `hero-fixed`/`hero-card` are
 * `position: fixed` and resize inside that reserved space. Growing hero-shell
 * to fill the viewport for chat mode is also what pushes the rest of the
 * page's content down and off-screen — no separate animation needed for
 * that, it's the same push that already happens for the sticky-bar collapse,
 * just taken further. Page scroll is also locked while chat is open (see
 * useHeroChat) so there's nothing to scroll past in the first place.
 *
 * Logo and auth actions never move or fade for chat mode (Figma 33160:232154
 * keeps them exactly where they always are) — only SearchPanel's own inner
 * content (mode tabs + field) cross-fades with the chat view, and that
 * swap happens *inside* SearchPanel's own 876px column, not across the
 * full hero width.
 */
export function HeroSection({
  forceCollapsed = false,
  initialCriteria,
}: {
  /** Search results page: the bar stays collapsed regardless of scroll. */
  forceCollapsed?: boolean;
  /** Prefills the search form from a deep link — see SearchPanel. */
  initialCriteria?: SearchCriteria;
} = {}) {
  const { ref, handlers } = useSpotlight<HTMLDivElement>();
  const { collapsed } = useHeroCollapse<HTMLElement>(forceCollapsed);
  const { open: chatOpen, openChat, closeChat } = useHeroChat();

  /**
   * The collapsed bar, clicked open (Figma 33133:39419) — the exact same
   * SearchPanel instance below, not a second copy: opening this only makes
   * .hero-card locally re-expand to its full CSS proportions (see
   * `.hero-card[data-modal-open]` in globals.css) and adds a backdrop
   * behind it. Nothing about SearchPanel's own state changes, so whatever
   * was already applied is exactly what's still there to edit.
   */
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (!modalOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setModalOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [modalOpen]);

  // Same reasoning as useHeroChat's own lock: the page behind the modal
  // shouldn't scroll while it's open, since there's nothing to reveal that
  // isn't already sitting under it. Combined with chatOpen (rather than a
  // plain `if (modalOpen) {...} else {...}` keyed on modalOpen alone) so
  // submitting an AI query from inside the modal — which closes the modal
  // and opens chat in the same event — can't have this effect's OWN cleanup
  // (running with a stale, pre-chat closure) undo the lock chat still
  // needs: the effect only re-runs at all when the COMBINED state actually
  // changes, so "locked for the modal" handing off to "locked for chat"
  // never round-trips through unlocked in between.
  const scrollLocked = modalOpen || chatOpen;
  useEffect(() => {
    if (!scrollLocked) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [scrollLocked]);

  return (
    <section className="hero-shell w-full">
      {/* Blur only — no dark tint — plus doubling as the click-catcher that
          closes the modal on an outside click (Escape and submitting a
          search already do too). Portalled rather than a plain sibling
          here so its fixed positioning is never at the mercy of an
          ancestor this component doesn't control (a future
          `transform`/`filter` on some wrapper would silently turn
          `position: fixed` into "fixed to that ancestor" instead of the
          viewport) — same reasoning FieldDropdownPortal documents for its
          own portal. Below .hero-fixed in z-index (see globals.css) so the
          card still sits sharp above the blurred page behind it. */}
      {modalOpen
        ? createPortal(
            <div
              aria-hidden
              onClick={() => setModalOpen(false)}
              className="search-modal-backdrop fixed inset-0 bg-black/10 backdrop-blur-[10px]"
            />,
            document.body,
          )
        : null}

      <div
        data-modal-open={modalOpen}
        className="hero-fixed w-full bg-white p-3"
      >
        <div
          ref={ref}
          {...handlers}
          data-modal-open={modalOpen}
          className="spotlight-host hero-card relative isolate overflow-hidden rounded-[24px] bg-surface p-6"
          style={{ "--spot-radius": "220px" } as CSSProperties}
        >
          {/* Fades out with either the collapse or the chat morph — a
              rotating world map and a cursor spotlight have nothing to say
              inside a 104px bar or behind a chat transcript. */}
          <div className="hero-backdrop">
            <WorldBackdrop />
          </div>

          <div className="hero-row relative z-10 flex w-full flex-col gap-6 lg:h-full lg:flex-row lg:items-start lg:justify-between lg:gap-4">
            <div className="flex items-center justify-between gap-4 lg:contents">
              <a
                href="/"
                aria-label="Luminous home"
                className="hero-brand shrink-0 lg:order-1"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/icons/logo.svg"
                  alt="Luminous"
                  width={131}
                  height={29}
                  className="block h-[29px] w-[130.929px]"
                />
              </a>

              <div className="hero-actions flex shrink-0 items-center gap-2 backdrop-blur-[22px] lg:order-3 lg:w-[131px] lg:justify-end">
                <button
                  type="button"
                  aria-label="Change region and language"
                  className="flex size-9 items-center justify-center rounded-lg bg-white text-neutral-900 transition-colors hover:bg-white/80"
                >
                  <Icon name="globe" />
                </button>
                <button
                  type="button"
                  className="flex h-9 items-center justify-center rounded-lg bg-white px-4 py-2 font-display text-[13px] tracking-[-0.26px] text-neutral-900 transition-colors hover:bg-white/80"
                >
                  Login
                </button>
              </div>
            </div>

            <SearchPanel
              collapsed={collapsed}
              chatOpen={chatOpen}
              onOpenChat={openChat}
              onCloseChat={closeChat}
              initialCriteria={initialCriteria}
              modalOpen={modalOpen}
              onOpenModal={() => setModalOpen(true)}
              onCloseModal={() => setModalOpen(false)}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
