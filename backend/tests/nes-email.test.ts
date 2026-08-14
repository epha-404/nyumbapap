import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { sendNesEmail } from "@/modules/email/nes";
import { renderOutboxEmail } from "@/modules/email/templates";
import { verifyNesSignature } from "@/modules/email/webhook";

describe("Nisoko Email Service", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("verifies current HMAC signatures and rejects stale ones", () => {
    const body = JSON.stringify({ event: "email.sent" });
    const secret = "s".repeat(32);
    const timestamp = "1786700000";
    const hash = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
    expect(verifyNesSignature(body, `t=${timestamp},v1=${hash}`, secret, Number(timestamp) * 1000)).toBe(true);
    expect(verifyNesSignature(body, `t=${timestamp},v1=${hash}`, secret, Number(timestamp) * 1000 + 301_000)).toBe(false);
  });

  it("uses the billing sender and does not expose the API key in the payload", async () => {
    process.env.NES_API_KEY = "nsk_live_test";
    process.env.NES_BILLING_FROM = "support@nisoko.co.ke";
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "message-1" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await sendNesEmail({ to: "tenant@example.com", category: "billing", subject: "Receipt", text: "Paid", html: "<p>Paid</p>" });
    const init = fetchMock.mock.calls[0]![1] as RequestInit;
    expect(init.headers).toMatchObject({ "X-API-Key": "nsk_live_test" });
    expect(JSON.parse(String(init.body))).toMatchObject({ from: "support@nisoko.co.ke", to: "tenant@example.com" });
    expect(String(init.body)).not.toContain("nsk_live_test");
  });

  it("renders escaped support and billing templates", () => {
    const email = renderOutboxEmail("PAYMENT_RECEIPT", { receipt: "<unsafe>" }, "Amina & Co");
    expect(email?.category).toBe("billing");
    expect(email?.html).toContain("Amina &amp; Co");
    expect(email?.html).not.toContain("<unsafe>");
  });
});
