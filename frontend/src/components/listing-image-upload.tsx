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
  const [uploadState, setUploadState] = useState<"IDLE" | "UPLOADING" | "FAILED" | "SUCCEEDED">("IDLE");

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setUploadState("UPLOADING");
    setError("");
    setMessage("");
    const form = event.currentTarget;
    try {
      const response = await csrfFetch(`dashboard/listings/${listingId}/images`, { method: "POST", body: new FormData(form) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setUploadState("FAILED");
        return setError(result.retryable ? "Media storage is temporarily unavailable. Your selected files remain here—retry in a moment." : result.error ?? "Could not upload images");
      }
      const count = Array.isArray(result.images) ? result.images.length : 0;
      setMessage(`${count} image${count === 1 ? "" : "s"} uploaded.`);
      setUploadState("SUCCEEDED");
      form.reset();
      router.refresh();
    } catch (caught) {
      setUploadState("FAILED");
      setError(caught instanceof Error ? caught.message : "The upload could not reach media storage. Retry in a moment.");
    } finally { setBusy(false); }
  }

  return <form className={styles.form} onSubmit={upload}>
    <label>Interior images
      <input name="images" type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple required />
    </label>
    <span className={styles.muted}>Up to 6 at once. JPEG, PNG, WebP, or AVIF.</span>
    {uploadState === "UPLOADING" && <p className={styles.muted} role="status">Upload pending—processing and storing your images…</p>}
    {uploadState === "FAILED" && <p className={styles.muted} role="status">Upload failed safely. Select Retry upload when you are ready.</p>}
    {error && <p className={styles.error} role="alert">{error}</p>}
    {message && <p className={styles.success} role="status">{message}</p>}
    <button className={styles.secondary} disabled={busy}>{busy ? "Processing..." : uploadState === "FAILED" ? "Retry upload" : "Upload images"}</button>
  </form>;
}
