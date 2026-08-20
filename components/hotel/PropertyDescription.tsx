"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { SectionTitle } from "./HotelOverview";
import type { DescriptionBlock } from "@/lib/hotel-data";

/**
 * The property description, as titled paragraphs.
 *
 * Everything here is PLAIN TEXT. LiteAPI's hotelDescription is HTML, but it
 * is parsed into `{ title, body }` blocks server-side (see
 * parseDescriptionBlocks) rather than sanitized and injected — so this
 * component can only ever emit text nodes, and there is no
 * dangerouslySetInnerHTML anywhere in the page.
 *
 * Show More is a real inline expand, not a modal: it swaps how many blocks
 * render, in place, keeping scroll position. The design's collapsed state
 * shows two blocks of a four-block description, so that is the cutoff.
 */
const COLLAPSED_BLOCKS = 2;

export function PropertyDescription({ blocks }: { blocks: DescriptionBlock[] }) {
  const [expanded, setExpanded] = useState(false);

  if (!blocks.length) return null;

  const canExpand = blocks.length > COLLAPSED_BLOCKS;
  const visible = expanded ? blocks : blocks.slice(0, COLLAPSED_BLOCKS);

  return (
    <section className="flex flex-col gap-5">
      <SectionTitle>Property description</SectionTitle>

      <div className="flex flex-col gap-4">
        {visible.map((block, index) => (
          <div key={`${block.title ?? "block"}-${index}`} className="flex flex-col gap-2">
            {block.title ? (
              <p className="font-display text-[16px] font-medium text-neutral-900">
                {block.title}
              </p>
            ) : null}
            <p className="text-[16px] leading-[1.6] text-[#4d5761]">{block.body}</p>
          </div>
        ))}

        {canExpand ? (
          <button
            type="button"
            onClick={() => setExpanded((open) => !open)}
            aria-expanded={expanded}
            className="flex w-fit cursor-pointer items-center gap-2 font-display text-[14px] font-medium text-brand underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none"
          >
            {expanded ? "Show less" : "Show more"}
            <Icon
              name="chevron-down"
              size={16}
              className="transition-transform"
              style={{ rotate: expanded ? "180deg" : "0deg" }}
            />
          </button>
        ) : null}
      </div>
    </section>
  );
}
