"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { PropertyCard, type Property } from "./PropertyCard";

/** Card width + gap from Figma — four cards fill the 1200px column exactly. */
const CARD_W = 285;
const GAP = 20;

export function PropertyCarousel({
  title,
  properties,
}: {
  title: string;
  properties: Property[];
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const sync = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 1);
    // 1px of slack keeps sub-pixel widths from leaving the button enabled.
    setAtEnd(el.scrollLeft >= el.scrollWidth - el.clientWidth - 1);
  }, []);

  useEffect(() => {
    sync();
    const el = trackRef.current;
    if (!el) return;
    const observer = new ResizeObserver(sync);
    observer.observe(el);
    return () => observer.disconnect();
  }, [sync]);

  const scrollByPage = (dir: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    // Advance by whole cards so the row never parks mid-card.
    const step = CARD_W + GAP;
    const cards = Math.max(1, Math.floor(el.clientWidth / step));
    el.scrollBy({ left: dir * cards * step, behavior: "smooth" });
  };

  return (
    <section className="flex flex-col gap-5">
      <SectionHeader
        title={title}
        onPrev={() => scrollByPage(-1)}
        onNext={() => scrollByPage(1)}
        prevDisabled={atStart}
        nextDisabled={atEnd}
      />

      <div
        ref={trackRef}
        onScroll={sync}
        className="no-scrollbar -mx-5 flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-smooth px-5"
      >
        {properties.map((property) => (
          <div
            key={property.id}
            className="w-[285px] shrink-0 snap-start"
            style={{ width: CARD_W }}
          >
            <PropertyCard property={property} />
          </div>
        ))}
      </div>
    </section>
  );
}
