"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "@/app/portal.module.css";
import { csrfFetch } from "@/lib/api";
import { IdentityDocumentUpload } from "./identity-document-upload";

export type OnboardingData = {
  role: "LANDLORD" | "AGENT";
  name: string;
  verificationState: "NOT_SUBMITTED" | "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";
  hasCredential: boolean;
};

export function ProfessionalOnboardingForm({ onboarding }: { onboarding: OnboardingData }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const body = Object.fromEntries(new FormData(event.currentTarget));
    const response = await csrfFetch("onboarding", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });
    const result = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) return setError(result.error ?? "Could not submit onboarding");
    event.currentTarget.reset();
    router.refresh();
  }

  return <section className={styles.card}>
    <span className={styles.eyebrow}>{onboarding.role === "AGENT" ? "Agent onboarding" : "Landlord onboarding"}</span>
    <h2>Professional verification</h2>
    <p className={styles.muted}>Status: <strong>{onboarding.verificationState.replaceAll("_", " ")}</strong>. Credentials are encrypted and are never returned by the API.</p>
    <form className={styles.form} onSubmit={submit}>
      {onboarding.role === "LANDLORD"
        ? <>
            <label>Display name<input name="displayName" required minLength={2} maxLength={80} defaultValue={onboarding.name} /></label>
            <label>National ID or passport number<input name="identityNumber" required minLength={5} maxLength={40} autoComplete="off" /></label>
          </>
        : <>
            <label>Agency name<input name="agencyName" required minLength={2} maxLength={120} defaultValue={onboarding.name} /></label>
            <label>Agent licence number<input name="licenceNumber" required minLength={3} maxLength={80} autoComplete="off" /></label>
          </>}
      {error && <p className={styles.error} role="alert">{error}</p>}
      <button className={styles.primary} disabled={busy}>{busy ? "Submitting..." : onboarding.hasCredential ? "Resubmit details" : "Submit onboarding"}</button>
    </form>
    <IdentityDocumentUpload role={onboarding.role} hasCredential={onboarding.hasCredential} />
  </section>;
}
