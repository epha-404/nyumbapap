import { afterEach, describe, expect, it, vi } from "vitest";
import { DarajaHttpError, DarajaProvider } from "@/modules/payments/mpesa";

describe("Daraja STK diagnostics", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("preserves the Daraja HTTP status and response body", async () => {
    process.env.MPESA_ENVIRONMENT = "sandbox";
    process.env.MPESA_BASE_URL_SANDBOX = "https://sandbox.safaricom.co.ke";
    process.env.MPESA_CONSUMER_KEY = "key";
    process.env.MPESA_CONSUMER_SECRET = "secret";
    process.env.MPESA_SHORTCODE = "174379";
    process.env.MPESA_PASSKEY = "passkey";
    process.env.MPESA_CALLBACK_URL = "https://example.ngrok-free.app/api/webhooks/mpesa";
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "token" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ errorCode: "500.001.1001", errorMessage: "Invalid credentials" }), { status: 400 })));

    const error = await new DarajaProvider().requestStkPush({ phoneE164: "+254700000000", amountKes: 250, accountReference: "payment-1", description: "unlock" }).catch((caught) => caught);
    expect(error).toBeInstanceOf(DarajaHttpError);
    expect(error).toMatchObject({ status: 400, category: "REQUEST" });
    expect(error.responseBody).toContain("Invalid credentials");
  });

  it("uses PayBill transaction type and Daraja field length limits", async () => {
    process.env.MPESA_ENVIRONMENT = "sandbox";
    process.env.MPESA_BASE_URL_SANDBOX = "https://sandbox.safaricom.co.ke";
    process.env.MPESA_SHORTCODE = "174379";
    process.env.MPESA_PASSKEY = "passkey";
    process.env.MPESA_CALLBACK_URL = "https://example.ngrok-free.app/api/webhooks/mpesa";
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ MerchantRequestID: "merchant-1", CheckoutRequestID: "checkout-1" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await new DarajaProvider().requestStkPush({ phoneE164: "+254708374149", amountKes: 0, accountReference: "a-reference-longer-than-twelve", description: "a description longer than thirteen" });
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const payload = JSON.parse(String(request.body));
    expect(payload).toMatchObject({ TransactionType: "CustomerPayBillOnline", Amount: 1, PartyA: "254708374149", PartyB: "174379", PhoneNumber: "254708374149" });
    expect(payload.Timestamp).toMatch(/^\d{14}$/);
    expect(Buffer.from(payload.Password, "base64").toString()).toBe(`174379passkey${payload.Timestamp}`);
    expect(payload.AccountReference).toHaveLength(12);
    expect(payload.TransactionDesc).toHaveLength(13);
  });
});
