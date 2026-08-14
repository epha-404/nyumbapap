import type { EmailCategory, NesEmail } from "./nes";

const escape = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
const labels: Record<string, [EmailCategory, string]> = {
  SECURITY_LOGIN: ["security", "New sign-in to your NyumbaPap account"],
  PAYMENT_RECEIPT: ["billing", "Your NyumbaPap payment receipt"],
  REPORT_RECEIVED: ["support", "We received your NyumbaPap report"],
  LISTING_REPORT_DISMISSED: ["support", "Update on a listing report"],
  LISTING_REPORT_TAKEDOWN: ["support", "Important listing safety update"],
  LISTING_TAKEN_DOWN: ["support", "Your listing has been paused"],
  NEW_ENQUIRY: ["operations", "You have a new listing enquiry"],
  ENQUIRY_UPDATED: ["operations", "Your listing enquiry was updated"],
  NEW_VIEWING_REQUEST: ["operations", "You have a new viewing request"],
  VIEWING_REQUEST_DECIDED: ["operations", "Your viewing request was updated"],
  LISTING_RECONFIRMED: ["operations", "Your listing was reconfirmed"],
  LISTING_EXPIRED: ["operations", "Your listing has expired"]
};

export function renderOutboxEmail(topic: string, payload: unknown, displayName: string): Omit<NesEmail, "to"> | null {
  const selected = labels[topic];
  if (!selected) return null;
  const [category, subject] = selected;
  const safeName = escape(displayName || "NyumbaPap user");
  const details = escape(JSON.stringify(payload));
  const text = `Hello ${displayName || "NyumbaPap user"},\n\n${subject}.\n\nReference details: ${JSON.stringify(payload)}\n\nNyumbaPap`;
  const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#17352f"><h2>${escape(subject)}</h2><p>Hello ${safeName},</p><p>${escape(subject)}.</p><div style="padding:12px;background:#f3f7f5;border-radius:8px"><strong>Reference details</strong><br><code>${details}</code></div><p>If you did not expect this message, contact support@nisoko.co.ke.</p><p>NyumbaPap</p></div>`;
  return { category, subject, text, html, replyTo: "support@nisoko.co.ke" };
}
