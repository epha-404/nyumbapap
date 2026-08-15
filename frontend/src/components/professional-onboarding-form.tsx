"use client";

import { FormEvent, useEffect, useState } from "react";
import type { AppRole } from "@nyumbapap/contracts";
import { useRouter } from "next/navigation";
import styles from "@/app/portal.module.css";
import { csrfFetch } from "@/lib/api";
import { IdentityDocumentUpload } from "./identity-document-upload";

export type OnboardingData = {
  role: Extract<AppRole, "LANDLORD" | "AGENT">;
  name: string;
  verificationState: "NOT_SUBMITTED" | "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";
  hasCredential: boolean;
};

export function ProfessionalOnboardingForm({ onboarding }: { onboarding: OnboardingData }) {
  const router = useRouter();
  const [current, setCurrent] = useState(onboarding);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => setCurrent(onboarding), [onboarding]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true);
    setError("");
    const body = Object.fromEntries(new FormData(form));
    const response = await csrfFetch("onboarding", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });
    const result = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) return setError(result.error ?? "Could not submit onboarding");
    if (result.onboarding) setCurrent(result.onboarding as OnboardingData);
    else setCurrent(value => ({ ...value, hasCredential: true, verificationState: "PENDING" }));
    const credential = form.elements.namedItem(current.role === "AGENT" ? "licenceNumber" : "identityNumber");
    if (credential instanceof HTMLInputElement) credential.value = "";
    router.refresh();
  }

  return <section className={styles.card}>
    <span className={styles.eyebrow}>{current.role === "AGENT" ? "Agent onboarding" : "Landlord onboarding"}</span>
    <h2>Professional verification</h2>
    <p className={styles.muted}>Status: <strong>{current.verificationState.replaceAll("_", " ")}</strong>. Credentials are encrypted and are never returned by the API.</p>
    <form className={styles.form} onSubmit={submit}>
      {current.role === "LANDLORD"
        ? <>
            <label>Display name<input name="displayName" required minLength={2} maxLength={80} defaultValue={current.name} /></label>
            <label>National ID or passport number<input name="identityNumber" required minLength={5} maxLength={40} autoComplete="off" /></label>
          </>
        : <>
            <label>Agency name<input name="agencyName" required minLength={2} maxLength={120} defaultValue={current.name} /></label>
            <label>Agent licence number<input name="licenceNumber" required minLength={3} maxLength={80} autoComplete="off" /></label>
          </>}
      {error && <p className={styles.error} role="alert">{error}</p>}
      <button className={styles.primary} disabled={busy}>{busy ? "Submitting..." : current.hasCredential ? "Resubmit details" : "Submit onboarding"}</button>
    </form>
    <IdentityDocumentUpload role={current.role} hasCredential={current.hasCredential} onUploaded={() => setCurrent(value => ({ ...value, verificationState: "PENDING" }))} />
  </section>;
}
