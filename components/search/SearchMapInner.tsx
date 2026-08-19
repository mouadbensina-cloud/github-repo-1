"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { createPortal } from "react-dom";
import { MapHotelCard } from "./MapHotelCard";
import type { Hotel } from "@/lib/search-data";

// Next.js only inlines this into the client bundle because next.config.ts
// lists it under `env` — mapbox-gl itself only ever reads the module-level
// export below, not process.env directly.
mapboxgl.accessToken = process.env.MAPBOX_TOKEN ?? "";

export function SearchMapInner({
  hotels,
  selectedId,
  hoveredId,
  onSelectHotel,
}: {
  hotels: Hotel[];
  selectedId?: string | null;
  hoveredId?: string | null;
  onSelectHotel?: (id: string | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const popupRef = useRef<mapboxgl.Popup | null>(null);
  // The popup's card is a real React tree (save button, truncation, etc.),
  // so it's portaled into the popup's DOM node rather than built by hand the
  // way the plain price-pill markers are below — that lets React own its
  // mount/unmount through the normal render cycle instead of a second,
  // manually-managed root, which raced React's own commit phase under
  // StrictMode (a real "synchronously unmount a root while rendering" error).
  const [popupContainer, setPopupContainer] = useState<HTMLDivElement | null>(
    null,
  );
  // Drives the placeholder below — the map itself isn't created until
  // hotels exist (see the effect below), so there's a real gap to cover
  // rather than an instant swap.
  const [mapReady, setMapReady] = useState(false);

  // Sets up the popup shell once — this doesn't need the map itself to
  // exist yet (Popup.setLngLat/.addTo are what need a live map, not
  // construction), so it's decoupled from map creation below.
  useEffect(() => {
    if (!mapboxgl.accessToken) {
      // eslint-disable-next-line no-console
      console.error(
        "MAPBOX_TOKEN is not set — add it to .env and restart the dev server.",
      );
    }

    const popupEl = document.createElement("div");
    popupRef.current = new mapboxgl.Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 16,
      maxWidth: "none",
      className: "map-hotel-popup",
    }).setDOMContent(popupEl);
    setPopupContainer(popupEl);

    return () => {
      popupRef.current?.remove();
      popupRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      markersRef.current.clear();
    };
  }, []);

  /**
   * The map itself is created lazily, on the first render where hotel
   * coordinates actually exist, seeded directly at those coordinates'
   * bounds via the constructor's own `bounds` option — not at some neutral
   * default center/zoom (previously `[0, 20]`, zoom 1) that then jumped to
   * the destination once the search resolved. That default was a real,
   * visible whole-Earth flash on every search: hotels load asynchronously,
   * so the map reliably mounted before any coordinates existed. Waiting for
   * real bounds means the very first frame the map ever paints is already
   * the destination — there is no "before" state left to flash.
   *
   * A stale mount is avoided the same way the old effect did (guarding on
   * `mapRef.current`, cleaned up in the effect above) — this just moves
   * *when* that first construction happens from mount-time to
   * data-ready-time, rather than changing what owns the map's lifecycle.
   */
  useEffect(() => {
    const container = containerRef.current;
    if (!container || hotels.length === 0) return;

    const bounds = new mapboxgl.LngLatBounds();
    for (const hotel of hotels) bounds.extend([hotel.lng, hotel.lat]);

    let map = mapRef.current;
    const justCreated = !map;
    if (!map) {
      map = new mapboxgl.Map({
        container,
        style: "mapbox://styles/mapbox/streets-v12",
        bounds,
        fitBoundsOptions: { padding: 60, maxZoom: 14 },
      });
      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
      // A click that reaches the map itself (not a marker — those stop
      // propagation in their own handler below) means the user clicked
      // empty map, which is this map's only way to dismiss the popup card.
      map.on("click", () => onSelectHotel?.(null));
      mapRef.current = map;
      setMapReady(true);
    }

    for (const marker of markersRef.current.values()) marker.remove();
    markersRef.current.clear();

    for (const hotel of hotels) {
      const el = document.createElement("button");
      el.type = "button";
      el.className = "search-map-pin";
      el.textContent = hotel.price;
      el.setAttribute("aria-label", hotel.name);
      el.addEventListener("click", (event) => {
        event.stopPropagation();
        onSelectHotel?.(hotel.id);
      });

      const marker = new mapboxgl.Marker({ element: el, anchor: "bottom" })
        .setLngLat([hotel.lng, hotel.lat])
        .addTo(map);
      markersRef.current.set(hotel.id, marker);
    }

    // Only for a search that REPLACES an already-fitted set of hotels (e.g.
    // editing the form on an already-loaded results page) — a freshly
    // created map above already fit these exact bounds via its own
    // constructor, so re-fitting here would just be a redundant no-op.
    if (!justCreated) {
      map.fitBounds(bounds, { padding: 60, maxZoom: 14, duration: 0 });
    }
    // onSelectHotel is a stable setState setter (see SearchPage) — safe to
    // leave out without going stale.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotels]);

  const selectedHotel = selectedId
    ? hotels.find((h) => h.id === selectedId)
    : null;

  useEffect(() => {
    for (const [id, marker] of markersRef.current) {
      marker.getElement().classList.toggle("search-map-pin--active", id === selectedId);
    }

    const map = mapRef.current;
    const popup = popupRef.current;
    if (!map || !popup) return;

    if (!selectedHotel) {
      popup.remove();
      return;
    }

    map.flyTo({ center: [selectedHotel.lng, selectedHotel.lat], zoom: 14, duration: 800 });
    popup.setLngLat([selectedHotel.lng, selectedHotel.lat]).addTo(map);
  }, [selectedId, selectedHotel]);

  // Hovering a card in the list highlights its pin — a lighter, separate
  // treatment from --active (the clicked/selected pin) so the two states
  // stay visually distinguishable if they land on different hotels at once.
  useEffect(() => {
    for (const [id, marker] of markersRef.current) {
      marker
        .getElement()
        .classList.toggle("search-map-pin--hovered", id === hoveredId);
    }
  }, [hoveredId]);

  return (
    <>
      <div ref={containerRef} className="size-full" />
      {/* Covers the gap between this component mounting and hotel
          coordinates actually existing — matching SearchMap's own
          dynamic-import loading fallback, so there's one consistent look
          for "the map isn't up yet" regardless of which stage causes it.
          Never a stuck state: `hotels` only stays empty while the search is
          still loading, and this page keeps this component mounted the
          whole time (see SearchPage) rather than remounting it per search. */}
      {!mapReady ? (
        <div className="absolute inset-0 flex items-center justify-center bg-surface text-[13px] text-neutral-500">
          Loading map…
        </div>
      ) : null}
      {popupContainer && selectedHotel
        ? createPortal(<MapHotelCard hotel={selectedHotel} />, popupContainer)
        : null}
    </>
  );
}
