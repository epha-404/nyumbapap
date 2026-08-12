"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "@/app/portal.module.css";
import { csrfFetch } from "@/lib/api";

export function IdentityDocumentUpload({ role, hasCredential }: { role: "LANDLORD" | "AGENT"; hasCredential: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setMessage(""); setError("");
    const response = await csrfFetch("onboarding/document", { method: "POST", body: new FormData(event.currentTarget) });
    const result = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) return setError(result.error ?? "Could not upload the document");
    event.currentTarget.reset();
    setMessage(result.message ?? "Document submitted for verification");
    router.refresh();
  }
  return <form className={styles.form} onSubmit={submit}>
    <label>{role === "AGENT" ? "Agent licence document" : "National ID or passport image"}
      <input name="document" type="file" accept="application/pdf,image/jpeg,image/png" required disabled={!hasCredential || busy} />
    </label>
    <p className={styles.muted}>PDF, JPEG, or PNG up to 10 MB. Documents remain private and are available only to authorized reviewers.</p>
    {!hasCredential && <p className={styles.error}>Save your professional details before uploading evidence.</p>}
    {error && <p className={styles.error} role="alert">{error}</p>}
    {message && <p role="status">{message}</p>}
    <button className={styles.secondary} disabled={!hasCredential || busy}>{busy ? "Uploading..." : "Submit verification document"}</button>
  </form>;
}
