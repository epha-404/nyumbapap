"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "@/app/portal.module.css";
import { csrfFetch } from "@/lib/api";

export function EmailMigrationForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [requested, setRequested] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function requestCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const response = await csrfFetch("auth/email-migration/request", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email }) });
    const body = await response.json().catch(() => ({})); setBusy(false);
    if (!response.ok) return setError(body.error ?? "Could not send code");
    setRequested(true);
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const code = String(new FormData(event.currentTarget).get("code") ?? "");
    const response = await csrfFetch("auth/email-migration/verify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, code }) });
    const body = await response.json().catch(() => ({})); setBusy(false);
    if (!response.ok) return setError(body.error ?? "Could not verify code");
    router.replace("/dashboard"); router.refresh();
  }

  if (requested) return <form className={styles.form} onSubmit={verifyCode}><p className={styles.muted}>Enter the six-digit code sent to {email}. It expires in five minutes.</p><label>Verification code<input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" required autoFocus /></label>{error && <p className={styles.error} role="alert">{error}</p>}<button className={styles.primary} disabled={busy}>{busy ? "Verifying..." : "Verify email"}</button></form>;
  return <form className={styles.form} onSubmit={requestCode}><label>Email address<input type="email" value={email} onChange={event => setEmail(event.target.value.trim())} autoComplete="email" required maxLength={254} /></label>{error && <p className={styles.error} role="alert">{error}</p>}<button className={styles.primary} disabled={busy}>{busy ? "Sending..." : "Send verification code"}</button></form>;
}
