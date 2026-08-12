"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";

type Point = { latitude: number; longitude: number };
const KENYA_BOUNDS = L.latLngBounds([-4.9, 33.9], [5.1, 41.9]);
const pin = L.divIcon({ className: "listing-map-pin", html: "<span aria-hidden='true'>●</span>", iconSize: [30, 30], iconAnchor: [15, 15] });

export function LocationPinMap({ point, onChange }: { point: Point; onChange: (point: Point) => void }) {
  const element = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const marker = useRef<L.Marker | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!element.current || map.current) return;
    const instance = L.map(element.current, { maxBounds: KENYA_BOUNDS.pad(0.08) }).setView([point.latitude, point.longitude], 14);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "&copy; OpenStreetMap contributors" }).addTo(instance);
    const draggable = L.marker([point.latitude, point.longitude], { draggable: true, icon: pin }).addTo(instance);
    draggable.on("dragend", () => { const next = draggable.getLatLng(); onChangeRef.current({ latitude: next.lat, longitude: next.lng }); });
    instance.on("click", (event: L.LeafletMouseEvent) => { draggable.setLatLng(event.latlng); onChangeRef.current({ latitude: event.latlng.lat, longitude: event.latlng.lng }); });
    map.current = instance;
    marker.current = draggable;
    return () => { instance.remove(); map.current = null; marker.current = null; };
  }, []);

  useEffect(() => {
    marker.current?.setLatLng([point.latitude, point.longitude]);
    map.current?.panTo([point.latitude, point.longitude]);
  }, [point.latitude, point.longitude]);

  return <div className="listing-location-map" ref={element} aria-label="Exact listing location map" />;
}
