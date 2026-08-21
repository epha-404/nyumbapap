"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "@/app/portal.module.css";
import { apiPath, csrfFetch } from "@/lib/api";
import { ListingForm, type ListingFields } from "./listing-form";
import { ListingImageUpload } from "./listing-image-upload";
import { formatLocationLabel } from "@/modules/listings/location-label";

type ListingSummary = {
  id: string;
  title: string;
  status: string;
  area: string;
  town: string;
  monthlyRentKes: number;
};

export function ListingManager({
  initialListings,
  canCreate
}: {
  initialListings: ListingSummary[];
  canCreate: boolean;
}) {
  const router = useRouter();
  const [listings, setListings] = useState(initialListings);
  const [editing, setEditing] = useState<ListingFields | null>(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  useEffect(() => setListings(initialListings), [initialListings]);

  async function edit(id: string) {
    setBusyId(id);
    setError("");
    const response = await fetch(apiPath(`dashboard/listings/${id}`), { credentials: "same-origin", cache: "no-store" });
    const result = await response.json().catch(() => ({}));
    setBusyId("");
    if (!response.ok) return setError(result.error ?? "Could not load listing");
    setEditing(result.listing);
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this listing? This cannot be undone.")) return;
    setBusyId(id);
    setError("");
    const response = await csrfFetch(`dashboard/listings/${id}`, { method: "DELETE" });
    const result = await response.json().catch(() => ({}));
    setBusyId("");
    if (!response.ok) return setError(result.error ?? "Could not delete listing");
    setListings((current) => current.filter((listing) => listing.id !== id));
    if (editing?.id === id) setEditing(null);
    router.refresh();
  }

  function saved() {
    setEditing(null);
    router.refresh();
  }

  return <>
    <h2>Your properties</h2>
    {error && <p className={styles.error} role="alert">{error}</p>}
    <section className={styles.grid}>
      {listings.map((listing) => <article className={`${styles.card} ${styles.listing}`} key={listing.id}>
        <span className={styles.badge}>{listing.status}</span>
        <h3>{listing.title}</h3>
        <span>{formatLocationLabel(listing.area, listing.town)}</span>
        <span className={styles.price}>KSh {listing.monthlyRentKes.toLocaleString("en-KE")}</span>
        <div className={styles.actions}>
          <button className={styles.secondary} type="button" disabled={busyId === listing.id} onClick={() => edit(listing.id)}>Edit</button>
          <button className={styles.secondary} type="button" disabled={busyId === listing.id} onClick={() => remove(listing.id)}>Delete</button>
        </div>
        <ListingImageUpload listingId={listing.id} />
      </article>)}
    </section>
    {editing && <section className={styles.card} style={{ marginTop: 30 }}>
      <span className={styles.eyebrow}>Edit vacancy</span>
      <h2>{editing.title}</h2>
      <ListingForm key={editing.id} initial={editing} onSaved={saved} onCancel={() => setEditing(null)} />
    </section>}
    <section id="new-vacancy" className={styles.card} style={{ marginTop: 30 }}>
      <span className={styles.eyebrow}>New vacancy</span>
      <h2>List a property</h2>
      {canCreate
        ? <ListingForm key="new-listing" onSaved={saved} />
        : <p className={styles.muted}>Submit your onboarding details before creating a listing.</p>}
    </section>
  </>;
}
