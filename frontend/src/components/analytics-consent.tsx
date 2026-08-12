"use client";

import { useEffect, useState } from "react";

const KEY = "nyumbapap.analytics-consent.v1";
type Choice = "granted" | "denied";

function publish(choice: Choice) {
  window.dispatchEvent(new CustomEvent("nyumbapap:analytics-consent", { detail: { analytics: choice } }));
}

export function AnalyticsConsent() {
  const [choice, setChoice] = useState<Choice | null | undefined>(undefined);
  useEffect(() => {
    const stored = localStorage.getItem(KEY);
    const current = stored === "granted" || stored === "denied" ? stored : null;
    setChoice(current);
    if (current) publish(current);
  }, []);

  function decide(next: Choice) {
    localStorage.setItem(KEY, next);
    setChoice(next);
    publish(next);
  }

  if (choice === undefined) return null;
  if (choice !== null) return <button type="button" className="consent-manage" onClick={() => setChoice(null)}>Privacy choices</button>;
  return <section className="consent-banner" aria-labelledby="consent-title" aria-live="polite">
    <div><h2 id="consent-title">Your privacy choices</h2><p>Essential storage keeps NyumbaPap secure. Optional analytics helps us understand which features work; it stays off unless you allow it. Read our <a href="/privacy">privacy notice</a>.</p></div>
    <div className="consent-actions"><button type="button" className="outline-button" onClick={() => decide("denied")}>Decline analytics</button><button type="button" className="button" onClick={() => decide("granted")}>Allow analytics</button></div>
  </section>;
}
