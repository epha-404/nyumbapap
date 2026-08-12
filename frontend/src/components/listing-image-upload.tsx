"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "@/app/portal.module.css";
import { csrfFetch } from "@/lib/api";

export function ListingImageUpload({ listingId }: { listingId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    const form = event.currentTarget;
    const response = await csrfFetch(`dashboard/listings/${listingId}/images`, {
      method: "POST",
      body: new FormData(form)
    });
    const result = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) return setError(result.error ?? "Could not upload images");
    const count = Array.isArray(result.images) ? result.images.length : 0;
    setMessage(`${count} image${count === 1 ? "" : "s"} uploaded.`);
    form.reset();
    router.refresh();
  }

  return <form className={styles.form} onSubmit={upload}>
    <label>Interior images
      <input name="images" type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple required />
    </label>
    <span className={styles.muted}>Up to 6 at once. JPEG, PNG, WebP, or AVIF.</span>
    {error && <p className={styles.error} role="alert">{error}</p>}
    {message && <p className={styles.success} role="status">{message}</p>}
    <button className={styles.secondary} disabled={busy}>{busy ? "Processing..." : "Upload images"}</button>
  </form>;
}
