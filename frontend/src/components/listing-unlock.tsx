"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { createPortal } from "react-dom";
import styles from "@/app/portal.module.css";
import { apiPath, csrfFetch } from "@/lib/api";

type Reveal = { contact: string; contactName: string; exactCoordinates: { latitude: number; longitude: number } };
type UiState = "IDLE" | "WAITING" | "PAID" | "CANCELLED" | "WRONG_PIN" | "INSUFFICIENT_FUNDS" | "TIMED_OUT" | "FAILED";
const ExactLocationMap = dynamic(() => import("./exact-location-map").then((module) => module.ExactLocationMap), { ssr: false });

const copy: Record<Exclude<UiState, "IDLE" | "PAID">, string> = {
  WAITING: "Check your phone and enter your M-Pesa PIN.",
  CANCELLED: "You cancelled the STK request. You can retry when ready.",
  WRONG_PIN: "The M-Pesa PIN was incorrect. Check it and retry.",
  INSUFFICIENT_FUNDS: "The M-Pesa account has insufficient funds. Use another number or add funds, then retry.",
  TIMED_OUT: "The STK request expired without a response. Please retry.",
  FAILED: "M-Pesa could not complete this request. Please retry."
};

export function ListingUnlock({ listingId, feeKes, signedIn, initiallyUnlocked }: { listingId: string; feeKes: number; signedIn: boolean; initiallyUnlocked: boolean }) {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [state, setState] = useState<UiState>(initiallyUnlocked ? "PAID" : "IDLE");
  const [error, setError] = useState("");
  const [reveal, setReveal] = useState<Reveal | null>(null);

  async function loadReveal() {
    const response = await fetch(apiPath(`listings/${listingId}/contact`), { credentials: "same-origin", cache: "no-store" });
    const result = await response.json().catch(() => ({}));
    if (response.ok) setReveal(result);
    else setError(result.error ?? "Could not reveal the listing contact");
  }

  useEffect(() => { if (initiallyUnlocked) void loadReveal(); }, [initiallyUnlocked]);
  useEffect(() => {
    if (!open || !signedIn || phone) return;
    fetch(apiPath("auth/session"), { credentials: "same-origin", cache: "no-store" }).then((response) => response.json()).then((result) => setPhone(String(result.session?.phone ?? "").replace(/^\+/, ""))).catch(() => {});
  }, [open, signedIn, phone]);

  useEffect(() => {
    if (!paymentId || state !== "WAITING") return;
    const started = Date.now();
    const timer = window.setInterval(async () => {
      const response = await fetch(apiPath(`payments/${paymentId}/status`), { credentials: "same-origin", cache: "no-store" });
      if (!response.ok) return;
      const result = await response.json();
      const next = result.payment.uiState as UiState;
      if (next !== "WAITING") {
        setState(next);
        window.clearInterval(timer);
        if (next === "PAID") await loadReveal();
      } else if (Date.now() - started >= 90_000) {
        setState("TIMED_OUT");
        window.clearInterval(timer);
      }
    }, 3_000);
    return () => window.clearInterval(timer);
  }, [paymentId, state]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [open]);

  async function startPayment() {
    setError("");
    if (!/^254[17]\d{8}$/.test(phone)) return setError("Enter a Safaricom number in the format 2547XXXXXXXX or 2541XXXXXXXX");
    const response = await csrfFetch("payments/mpesa/stk-push", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ listingId, phoneE164: phone }) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) return setError(result.error ?? "Could not start M-Pesa payment");
    setPaymentId(result.payment.id);
    setState("WAITING");
  }

  if (reveal) return <section className={styles.card}>
    <span className={styles.eyebrow}>Unlocked</span><h2>Contact and exact location</h2>
    <p><strong>{reveal.contactName}</strong><br /><a href={`tel:${reveal.contact}`}>{reveal.contact}</a></p>
    <ExactLocationMap {...reveal.exactCoordinates} />
  </section>;

  if (!signedIn) return <Link className={styles.primary} href={`/login?returnTo=${encodeURIComponent(`/listings/${listingId}`)}`}>Unlock contact &amp; exact location — KES {feeKes.toLocaleString("en-KE")}</Link>;

  return <>
    <button className={styles.primary} type="button" onClick={() => setOpen(true)}>Unlock contact &amp; exact location — KES {feeKes.toLocaleString("en-KE")}</button>
    {open && createPortal(<div className="dialog-backdrop payment-dialog-backdrop" onMouseDown={() => setOpen(false)}><div className="dialog-panel payment-dialog-panel" role="dialog" aria-modal="true" aria-labelledby="payment-title" onMouseDown={(event) => event.stopPropagation()}>
      <button className="modal-close" type="button" aria-label="Close payment" onClick={() => setOpen(false)}>×</button>
      <div className="modal-inner"><h2 id="payment-title">Unlock this listing</h2>
        <p>One-time fee: <strong>KES {feeKes.toLocaleString("en-KE")}</strong></p>
        <label>Safaricom phone number<input value={phone} onChange={(event) => setPhone(event.target.value.replace(/\D/g, ""))} inputMode="tel" placeholder="2547XXXXXXXX" disabled={state === "WAITING"} /></label>
        {state === "PAID" && <p role="status">Payment received. Loading the protected listing details…</p>}
        {state !== "IDLE" && state !== "PAID" && <p role="status">{copy[state]}</p>}
        {error && <p className={styles.error} role="alert">{error}</p>}
        {state !== "WAITING" && state !== "PAID" && <button className={styles.primary} type="button" onClick={startPayment}>{state === "IDLE" ? "Send STK push" : "Retry payment"}</button>}
      </div>
    </div></div>, document.body)}
  </>;
}
