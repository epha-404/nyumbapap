"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "@/app/portal.module.css";
import { csrfFetch } from "@/lib/api";

type Challenge = { id: string; phone: string };

export function PortalAuthForm({ mode, returnTo = "/dashboard" }: { mode: "login" | "register"; returnTo?: string }) {
  const router = useRouter();
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function requestCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const details = Object.fromEntries(new FormData(event.currentTarget));
    const phone = String(details.phone ?? "");
    const body = mode === "login"
      ? { mode: "LOGIN", phone }
      : { mode: "REGISTER", phone, displayName: details.displayName, role: details.role };
    const response = await csrfFetch("auth/otp/request", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });
    const result = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) return setError(result.error ?? "Could not send a code");
    setChallenge({ id: result.challengeId, phone });
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!challenge) return;
    setBusy(true);
    setError("");
    const code = String(new FormData(event.currentTarget).get("code") ?? "");
    const response = await csrfFetch("auth/otp/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ challengeId: challenge.id, code })
    });
    const result = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) return setError(result.error ?? "Could not verify the code");
    router.replace(returnTo);
    router.refresh();
  }

  if (challenge) {
    return <form key="otp-verification" className={styles.form} onSubmit={verifyCode}>
      <p className={styles.muted}>Enter the six-digit code sent to {challenge.phone}. It expires in five minutes.</p>
      <label>Verification code<input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required autoFocus /></label>
      {error && <p className={styles.error} role="alert">{error}</p>}
      <button className={styles.primary} disabled={busy}>{busy ? "Verifying..." : "Verify and continue"}</button>
      <button className={styles.secondary} type="button" disabled={busy} onClick={() => { setChallenge(null); setError(""); }}>Use a different number</button>
    </form>;
  }

  return <form key="phone-entry" className={styles.form} onSubmit={requestCode}>
    {mode === "register" && <>
      <label>Full name<input name="displayName" autoComplete="name" required minLength={2} maxLength={80} placeholder="e.g. Amina Kamau" /></label>
      <label>Account type<select name="role" defaultValue="CLIENT"><option value="CLIENT">Client / home seeker</option><option value="LANDLORD">Landlord</option><option value="AGENT">Property agent</option></select></label>
    </>}
    <label>Phone number<input name="phone" type="tel" autoComplete="tel" required minLength={10} maxLength={20} placeholder="07XX XXX XXX" /></label>
    {error && <p className={styles.error} role="alert">{error}</p>}
    <button className={styles.primary} disabled={busy}>{busy ? "Sending code..." : "Send verification code"}</button>
  </form>;
}
