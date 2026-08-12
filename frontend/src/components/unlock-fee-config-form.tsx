"use client";

import { useState } from "react";
import styles from "@/app/portal.module.css";
import { csrfFetch } from "@/lib/api";

export type UnlockFeeConfig = {
  rate: number;
  floorKes: number;
  ceilingKes: number;
  updatedAt: string;
};

export function UnlockFeeConfigForm({ initialConfig }: { initialConfig: UnlockFeeConfig }) {
  const [config, setConfig] = useState(initialConfig);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSaved(false);
    const values = new FormData(event.currentTarget);
    const response = await csrfFetch("admin/unlock-fee", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        rate: Number(values.get("rate")),
        floorKes: Number(values.get("floorKes")),
        ceilingKes: Number(values.get("ceilingKes"))
      })
    });
    const result = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) return setError(result.error ?? "Could not update the unlock fee");
    setConfig(result.config);
    setSaved(true);
  }

  return <section className={styles.card} style={{ marginTop: 30 }}>
    <span className={styles.eyebrow}>Payment configuration</span>
    <h2>Rent-based unlock fee</h2>
    <p className={styles.muted}>A one-time fee calculated from the listing's stored monthly rent and rounded to the nearest KES 10.</p>
    <form className={styles.form} onSubmit={submit}>
      <label>Rate
        <input name="rate" type="number" min="0.000001" max="1" step="0.000001" defaultValue={config.rate} required />
      </label>
      <label>Minimum fee (KES)
        <input name="floorKes" type="number" min="1" step="1" defaultValue={config.floorKes} required />
      </label>
      <label>Maximum fee (KES)
        <input name="ceilingKes" type="number" min="1" step="1" defaultValue={config.ceilingKes} required />
      </label>
      {error && <p className={styles.error} role="alert">{error}</p>}
      {saved && <p role="status">Unlock fee configuration saved.</p>}
      <button className={styles.primary} type="submit" disabled={busy}>{busy ? "Saving…" : "Save fee configuration"}</button>
    </form>
  </section>;
}
