export type EmailCategory = "security" | "support" | "billing" | "operations";
export type NesEmail = { to: string; subject: string; text: string; html: string; category: EmailCategory; replyTo?: string };

export class NesEmailError extends Error {
  constructor(message: string, public readonly status: number, public readonly responseBody: string) { super(message); this.name = "NesEmailError"; }
}

function sender(category: EmailCategory) {
  if (category === "security") return process.env.NES_SECURITY_FROM ?? "security@odafood.com";
  if (category === "billing") return process.env.NES_BILLING_FROM ?? "billing@odafood.com";
  return process.env.NES_SUPPORT_FROM ?? "support@odafood.com";
}

export async function sendNesEmail(email: NesEmail) {
  const apiKey = process.env.NES_API_KEY?.trim();
  if (!apiKey) throw new Error("NES_API_KEY is not configured");
  const baseUrl = (process.env.NES_API_URL ?? "https://nes.nisoko.co.ke").replace(/\/$/, "");
  const response = await fetch(`${baseUrl}/api/v1/nes/send`, {
    method: "POST",
    headers: { "X-API-Key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ from: sender(email.category), to: email.to, subject: email.subject, text: email.text, html: email.html, ...(email.replyTo ? { reply_to: email.replyTo } : {}) }),
    signal: AbortSignal.timeout(15_000)
  });
  const body = (await response.text()).slice(0, 4096);
  if (!response.ok) throw new NesEmailError(`NES send failed (${response.status})`, response.status, body);
  try { return JSON.parse(body) as Record<string, unknown>; } catch { return { accepted: true }; }
}

export class NesEmailProvider implements EmailProvider {
  async sendOtp(input: OtpEmail) {
    const minutes = Math.ceil(input.expiresInSeconds / 60);
    const subject = "Your NyumbaPap verification code";
    const text = `Your NyumbaPap verification code is ${input.code}. It expires in ${minutes} minutes. Do not share this code.`;
    const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#17352f"><h2>Your verification code</h2><p>Enter this code in NyumbaPap:</p><p style="font-size:32px;font-weight:700;letter-spacing:8px">${input.code}</p><p>This code expires in ${minutes} minutes. Do not share it with anyone.</p></div>`;
    const result = await sendNesEmail({ to: input.to, subject, text, html, category: "security" });
    const providerMessageId = result.id ?? result.message_id ?? result.messageId;
    return { providerMessageId: typeof providerMessageId === "string" ? providerMessageId : "accepted" };
  }
}
import type { EmailProvider, OtpEmail } from "./provider";
