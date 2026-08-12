"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";

export function ExactLocationMap({ latitude, longitude }: { latitude: number; longitude: number }) {
  const element = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!element.current) return;
    const map = L.map(element.current).setView([latitude, longitude], 17);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "&copy; OpenStreetMap contributors" }).addTo(map);
    L.circleMarker([latitude, longitude], { radius: 10, color: "#075b49", fillColor: "#f2994a", fillOpacity: 1 }).addTo(map);
    return () => { map.remove(); };
  }, [latitude, longitude]);
  return <div className="listing-location-map" ref={element} aria-label="Exact unlocked listing location" />;
}
