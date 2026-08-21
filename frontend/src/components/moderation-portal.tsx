"use client";

import { useState } from "react";
import { csrfFetch } from "@/lib/api";
import portal from "@/app/portal.module.css";
import { formatLocationLabel } from "@/modules/listings/location-label";
import styles from "@/app/dashboard/verifier/moderation.module.css";

type IdentityItem = { id: string; kind: string; role: string; subjectName: string; submittedAt: string; documentUrl: string };
type PhotoItem = { id: string; listingId: string; listingTitle: string; submitterName?: string; width: number; height: number; submittedAt: string; contentUrl: string };
type ListingItem = { id: string; title: string; unitType: string; monthlyRentKes: number; town: string; area: string; submittedAt: string };
type Badge = { label: string; validDays: number; expiringSoonDays: number };
export type ModerationData = { badgeDefinitions: Record<string, Badge>; identities: IdentityItem[]; photos: PhotoItem[]; listings: ListingItem[] };

export function ModerationPortal({ initialData }: { initialData: ModerationData }) {
  const [identities, setIdentities] = useState(initialData.identities);
  const [photos, setPhotos] = useState(initialData.photos);
  const [listings, setListings] = useState(initialData.listings);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [unavailablePhotos, setUnavailablePhotos] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function decide(type: "identities" | "photos", id: string, decision: "APPROVE" | "REJECT") {
    setBusy(id); setError(""); setNotice("");
    const response = await csrfFetch(`moderation/${type}/${id}`, {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision, notes: notes[id] ?? "" })
    });
    const result = await response.json().catch(() => ({}));
    setBusy("");
    if (!response.ok) return setError(result.error ?? "The decision could not be saved");
    if (type === "identities") setIdentities((items) => items.filter((item) => item.id !== id));
    else {
      const photo = photos.find(item => item.id === id);
      setPhotos((items) => items.filter((item) => item.id !== id));
      if (photo && result.listingState !== "PENDING") setListings(items => items.filter(item => item.id !== photo.listingId));
    }
    setNotice(`${type === "photos" ? "Photo" : "Identity"} ${decision === "APPROVE" ? "approved" : "rejected"}.`);
  }

  return <>
    <section className={styles.badges} aria-label="Badge expiry policy">
      {Object.entries(initialData.badgeDefinitions).map(([kind, badge]) => <article className={portal.card} key={kind}>
        <span className={portal.eyebrow}>{kind.replaceAll("_", " ")}</span>
        <h3>{badge.label}</h3>
        <p className={portal.muted}>Valid for {badge.validDays} days. Marked expiring {badge.expiringSoonDays} days before expiry.</p>
      </article>)}
    </section>
    {error && <p className={portal.error} role="alert">{error}</p>}
    {notice && <p className={portal.muted} role="status">{notice}</p>}
    <section className={styles.section}>
      <div className={styles.sectionHeader}><div><span className={portal.eyebrow}>Listing queue</span><h2>New property submissions</h2></div><span className={portal.badge}>{listings.length} pending</span></div>
      {!listings.length && <p className={portal.muted}>No new listings are awaiting interior-photo review.</p>}
      <div className={styles.queue}>{listings.map((item) => <article className={styles.reviewCard} key={item.id}>
        <div><h3>{item.title}</h3><p className={portal.muted}>{item.unitType} · {formatLocationLabel(item.area, item.town)} · KSh {item.monthlyRentKes.toLocaleString("en-KE")} · submitted {new Date(item.submittedAt).toLocaleString("en-KE")}</p></div>
        <p className={portal.muted}>The listing remains pending until its submitted interior photos are reviewed.</p>
      </article>)}</div>
    </section>
    <section className={styles.section}>
      <div className={styles.sectionHeader}><div><span className={portal.eyebrow}>Identity queue</span><h2>Landlord and agent evidence</h2></div><span className={portal.badge}>{identities.length} pending</span></div>
      {!identities.length && <p className={portal.muted}>No identity documents are awaiting review.</p>}
      <div className={styles.queue}>{identities.map((item) => <article className={styles.reviewCard} key={item.id}>
        <div><h3>{item.subjectName}</h3><p className={portal.muted}>{item.kind.replaceAll("_", " ")} - submitted {new Date(item.submittedAt).toLocaleString("en-KE")}</p></div>
        <a className={styles.evidenceLink} href={item.documentUrl} target="_blank" rel="noreferrer">Open private document</a>
        <label>Reviewer notes<textarea value={notes[item.id] ?? ""} maxLength={1000} onChange={(event) => setNotes({ ...notes, [item.id]: event.target.value })} /></label>
        <div className={portal.actions}><button className={portal.primary} disabled={busy === item.id} onClick={() => decide("identities", item.id, "APPROVE")}>Approve</button><button className={styles.reject} disabled={busy === item.id} onClick={() => decide("identities", item.id, "REJECT")}>Reject</button></div>
      </article>)}</div>
    </section>
    <section className={styles.section}>
      <div className={styles.sectionHeader}><div><span className={portal.eyebrow}>Photo queue</span><h2>Listing interiors</h2></div><span className={portal.badge}>{photos.length} pending</span></div>
      {!photos.length && <p className={portal.muted}>No listing photos are awaiting review.</p>}
      <div className={styles.photoGrid}>{photos.map((item) => <article className={styles.reviewCard} key={item.id}>
        <img className={styles.photo} src={item.contentUrl} alt={`Interior submitted for ${item.listingTitle}`} width={item.width} height={item.height} onError={() => setUnavailablePhotos(current => new Set(current).add(item.id))} />
        <div><h3>{item.listingTitle}</h3><p className={portal.muted}>Submitted {new Date(item.submittedAt).toLocaleString("en-KE")}</p></div>
        {unavailablePhotos.has(item.id) && <p className={portal.error} role="alert">This image could not be loaded. Ask the landlord to upload it again before approval.</p>}
        <label>Reviewer notes<textarea value={notes[item.id] ?? ""} maxLength={1000} onChange={(event) => setNotes({ ...notes, [item.id]: event.target.value })} /></label>
        <div className={portal.actions}><button type="button" className={portal.primary} disabled={busy === item.id || unavailablePhotos.has(item.id)} onClick={() => decide("photos", item.id, "APPROVE")}>Approve</button><button type="button" className={styles.reject} disabled={busy === item.id} onClick={() => decide("photos", item.id, "REJECT")}>Reject</button></div>
      </article>)}</div>
    </section>
  </>;
}
