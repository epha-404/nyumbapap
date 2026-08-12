"use client";

import { FormEvent, useState } from "react";
import dynamic from "next/dynamic";
import styles from "@/app/portal.module.css";
import { apiPath, csrfFetch } from "@/lib/api";

const LocationPinMap = dynamic(() => import("./location-pin-map").then((module) => module.LocationPinMap), { ssr: false });

export type ListingFields = {
  id: string;
  title: string;
  description: string;
  county: string;
  town: string;
  area: string;
  address: string;
  contact: string;
  unitType: string;
  bedrooms: number;
  bathrooms: number;
  size: number;
  rent: number;
  deposit: number;
  latitude?: number;
  longitude?: number;
  locationConfirmed?: boolean;
};

export function ListingForm({
  initial,
  onSaved,
  onCancel
}: {
  initial?: ListingFields | null;
  onSaved?: () => void;
  onCancel?: () => void;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [point, setPoint] = useState({ latitude: initial?.latitude ?? -1.286389, longitude: initial?.longitude ?? 36.817223 });
  const [locationConfirmed, setLocationConfirmed] = useState(Boolean(initial?.locationConfirmed));
  const [address, setAddress] = useState(initial?.address ?? "");

  async function locate() {
    setLocating(true);
    setError("");
    const response = await fetch(`${apiPath("geocoding/locate")}?q=${encodeURIComponent(address)}`, { credentials: "same-origin", cache: "no-store" });
    const result = await response.json().catch(() => ({}));
    setLocating(false);
    if (!response.ok) return setError(result.error ?? "Could not locate this address");
    const match = result.results?.[0];
    if (!match) return setError("No Kenyan location matched that address. Add more detail or place the pin manually.");
    setPoint({ latitude: match.latitude, longitude: match.longitude });
    setLocationConfirmed(false);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const body = Object.fromEntries(new FormData(event.currentTarget));
    const response = await csrfFetch(initial ? `dashboard/listings/${initial.id}` : "dashboard/listings", {
      method: initial ? "PUT" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });
    const result = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) return setError(result.error ?? "Could not save listing");
    if (!initial) event.currentTarget.reset();
    onSaved?.();
  }

  return <form className={styles.form} onSubmit={submit}>
    <label>Listing title<input name="title" required minLength={5} maxLength={120} defaultValue={initial?.title} placeholder="Bright two-bedroom apartment" /></label>
    <label>Description<textarea name="description" required minLength={20} maxLength={2000} defaultValue={initial?.description} placeholder="Describe the home, nearby transport and amenities" /></label>
    <div className={styles.grid}>
      <label>County<input name="county" required defaultValue={initial?.county ?? "Nairobi"} /></label>
      <label>Town (coarse value is resolved on save)<input name="town" required defaultValue={initial?.town ?? "Nairobi"} /></label>
      <label>Area (coarse value is resolved on save)<input name="area" required defaultValue={initial?.area ?? "Pending location lookup"} /></label>
      <label>Exact address<input name="address" required value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Kept private" /></label>
      <label>Owner contact<input name="contact" required defaultValue={initial?.contact} placeholder="07XX XXX XXX" /></label>
      <label>Home type<select name="unitType" defaultValue={initial?.unitType ?? "1 Bedroom"}><option>Bedsitter</option><option>1 Bedroom</option><option>2 Bedroom</option><option>3 Bedroom</option></select></label>
      <label>Bedrooms<input name="bedrooms" type="number" min="0" max="20" defaultValue={initial?.bedrooms ?? 1} required /></label>
      <label>Bathrooms<input name="bathrooms" type="number" min="1" max="20" defaultValue={initial?.bathrooms ?? 1} required /></label>
      <label>Size (square metres)<input name="size" type="number" min="10" max="10000" defaultValue={initial?.size ?? 45} required /></label>
      <label>Monthly rent (KES)<input name="rent" type="number" min="1000" defaultValue={initial?.rent} required /></label>
      <label>Deposit (KES)<input name="deposit" type="number" min="0" defaultValue={initial?.deposit ?? 0} required /></label>
    </div>
    <section>
      <h3>Exact unit location</h3>
      <p className={styles.muted}>Locate the address or click and drag the pin. The exact point stays encrypted; only a randomly displaced point is public.</p>
      <div className={styles.actions}>
        <button className={styles.secondary} type="button" disabled={locating || address.trim().length < 3} onClick={locate}>{locating ? "Locating…" : "Locate address"}</button>
        <button className={styles.secondary} type="button" onClick={() => setLocationConfirmed(true)}>Confirm pin location</button>
      </div>
      <LocationPinMap point={point} onChange={(next) => { setPoint(next); setLocationConfirmed(false); }} />
      <input type="hidden" name="latitude" value={point.latitude} />
      <input type="hidden" name="longitude" value={point.longitude} />
      <input type="hidden" name="locationConfirmed" value={String(locationConfirmed)} />
      <p role="status">{locationConfirmed ? "Location confirmed and ready to save." : "Confirm the pin before submitting."}</p>
    </section>
    {error && <p className={styles.error} role="alert">{error}</p>}
    <div className={styles.actions}>
      <button className={styles.primary} disabled={busy}>{busy ? "Saving..." : initial ? "Save changes" : "Submit for review"}</button>
      {initial && <button className={styles.secondary} type="button" disabled={busy} onClick={onCancel}>Cancel</button>}
    </div>
  </form>;
}
