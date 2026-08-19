"use client";

import { useState } from "react";

/**
 * Drives the hero -> fullscreen-chat morph. Same technique as
 * useHeroCollapse — flip one number (--chat-p, 0 or 1) and let a CSS
 * `transition` on that registered custom property carry the whole thing —
 * except triggered by clicking Enter / Back instead of by scroll position.
 *
 * There is only one hero: this morphs it in place from the search panel to
 * the fullscreen chat layout, rather than swapping in a second component.
 * See the geometry block at the end of globals.css for what actually reads
 * --chat-p, and --chat-out / --chat-in for the two derived opacity curves
 * (things leaving lead, the chat view arriving trails) — identical shape to
 * --cf / --ci from the scroll-collapse feature.
 *
 * Page scroll is locked while chat is open: the hero grows to fill the
 * viewport, so anything scroll would reveal is the same content this is
 * already covering — without the lock the page could still scroll past it.
 */
export function useHeroChat() {
  const [open, setOpen] = useState(false);

  const openChat = () => {
    document.documentElement.style.setProperty("--chat-p", "1");
    document.body.style.overflow = "hidden";
    setOpen(true);
  };

  const closeChat = () => {
    document.documentElement.style.setProperty("--chat-p", "0");
    document.body.style.overflow = "";
    setOpen(false);
  };

  return { open, openChat, closeChat };
}
