"use client";

import { FormEvent, useState } from "react";
import type { AppRole } from "@/lib/role-contract";
import { useRouter } from "next/navigation";
import styles from "@/app/portal.module.css";
import { csrfFetch } from "@/lib/api";

export function IdentityDocumentUpload({ role, hasCredential, onUploaded }: { role: Extract<AppRole, "LANDLORD" | "AGENT">; hasCredential: boolean; onUploaded?: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [file, setFile] = useState<File | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!hasCredential) return setError("Save your professional details before uploading evidence.");
    if (!file) return setError("Choose a verification document");
    setBusy(true); setMessage(""); setError("");
    const body = new FormData();
    body.append("document", file);
    const response = await csrfFetch("onboarding/document", { method: "POST", body });
    const result = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) return setError(result.error ?? "Could not upload the document");
    form.reset();
    setFile(null);
    setMessage(result.message ?? "Document submitted for verification");
    onUploaded?.();
    router.refresh();
  }
  return <form className={styles.form} onSubmit={submit}>
    <label>{role === "AGENT" ? "Agent licence document" : "National ID or passport image"}
      <input name="document" type="file" accept="application/pdf,image/jpeg,image/png" required disabled={!hasCredential || busy} onChange={event => { setFile(event.currentTarget.files?.[0] ?? null); setError(""); setMessage(""); }} />
    </label>
    <p className={styles.muted} aria-live="polite">{file ? `Selected: ${file.name}` : "No file chosen"}</p>
    <p className={styles.muted}>PDF, JPEG, or PNG up to 10 MB. Documents remain private and are available only to authorized reviewers.</p>
    {!hasCredential && <p className={styles.error}>Save your professional details before uploading evidence.</p>}
    {error && <p className={styles.error} role="alert">{error}</p>}
    {message && <p role="status">{message}</p>}
    <button className={styles.secondary} disabled={!hasCredential || !file || busy}>{busy ? "Uploading..." : "Submit verification document"}</button>
  </form>;
}
