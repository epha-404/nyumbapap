"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "@/app/portal.module.css";
import { csrfFetch } from "@/lib/api";

type RequestBody = { mode: "LOGIN" | "REGISTER"; email: string; displayName?: FormDataEntryValue; role?: FormDataEntryValue };
type Challenge = { email: string; request: RequestBody };

export function PortalAuthForm({ mode, returnTo = "/dashboard", initialEmail = "", initialRole = "CLIENT" }: { mode: "login" | "register"; returnTo?: string; initialEmail?: string; initialRole?: "CLIENT" | "LANDLORD" | "AGENT" }) {
  const router = useRouter();
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => setCooldown(value => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [cooldown > 0]);

  async function sendCode(body: RequestBody) {
    setBusy(true);
    setError("");
    setNotice("");
    const response = await csrfFetch("auth/otp/request", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });
    const result = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      const retryAfter = Number(response.headers.get("retry-after") ?? 0);
      if (retryAfter > 0) setCooldown(retryAfter);
      setError(result.error ?? "Could not send a code");
      return false;
    }
    if (mode === "login" && result.registrationRequired === true) {
      const query = new URLSearchParams({ email: body.email, returnTo });
      router.replace(`/register?${query.toString()}`);
      return false;
    }
    if (mode === "register" && result.loginRequired === true) {
      const query = new URLSearchParams({ email: body.email, returnTo });
      router.replace(`/login?${query.toString()}`);
      return false;
    }
    setCooldown(Number(result.cooldownSeconds) || 300);
    setNotice(result.message ?? "If this email can receive a code, one has been sent.");
    return true;
  }

  async function requestCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const details = Object.fromEntries(new FormData(event.currentTarget));
    const email = String(details.email ?? "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setError("Enter a valid email address");
    const body: RequestBody = mode === "login"
      ? { mode: "LOGIN", email }
      : { mode: "REGISTER", email, displayName: details.displayName, role: details.role };
    if (await sendCode(body)) setChallenge({ email, request: body });
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
      body: JSON.stringify({ email: challenge.email, code })
    });
    const result = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) return setError(result.error ?? "Could not verify the code");
    router.replace(returnTo);
    router.refresh();
  }

  if (challenge) {
    const minutes = Math.floor(cooldown / 60);
    const seconds = String(cooldown % 60).padStart(2, "0");
    return <form key="otp-verification" className={styles.form} onSubmit={verifyCode}>
      <p className={styles.muted}>Enter the six-digit code sent to {challenge.email}. It expires in five minutes.</p>
      <p className={styles.muted}>{mode === "login" ? "This code signs you in to your existing account." : "If this email already belongs to an account, use the sign-in page instead."}</p>
      {notice && <p className={styles.muted} role="status">{notice}</p>}
      <label>Verification code<input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required autoFocus /></label>
      {error && <p className={styles.error} role="alert">{error}</p>}
      <button className={styles.primary} disabled={busy}>{busy ? "Verifying..." : "Verify and continue"}</button>
      <button className={styles.secondary} type="button" disabled={busy || cooldown > 0} onClick={() => void sendCode(challenge.request)}>
        {cooldown > 0 ? `Resend available in ${minutes}:${seconds}` : "Resend email"}
      </button>
      <button className={styles.secondary} type="button" disabled={busy} onClick={() => { setChallenge(null); setError(""); setNotice(""); setCooldown(0); }}>Use a different email</button>
    </form>;
  }

  return <form key="email-entry" className={styles.form} onSubmit={requestCode}>
    {mode === "register" && <>
      <label>Full name<input name="displayName" autoComplete="name" required minLength={2} maxLength={80} placeholder="e.g. Amina Kamau" /></label>
      <label>Account type<select name="role" defaultValue={initialRole}><option value="CLIENT">Client / home seeker</option><option value="LANDLORD">Landlord</option><option value="AGENT">Property agent</option></select></label>
    </>}
    <label>Email address<input name="email" type="email" autoComplete="email" required maxLength={254} placeholder="you@example.com" defaultValue={initialEmail} /></label>
    {error && <p className={styles.error} role="alert">{error}</p>}
    <button className={styles.primary} disabled={busy}>{busy ? "Sending code..." : "Send verification code"}</button>
  </form>;
}
