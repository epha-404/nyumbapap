import { z } from "zod";
export class DarajaHttpError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly responseBody: string,
    public readonly category: "AUTH" | "REQUEST"
  ) {
    super(message);
    this.name = "DarajaHttpError";
  }
}
export interface MobileMoneyProvider { requestStkPush(input: { phoneE164: string; amountKes: number; accountReference: string; description: string }): Promise<{ merchantRequestId: string; checkoutRequestId: string }> }

let cachedToken: { value: string; expiresAt: number } | null = null;
let tokenRequest: Promise<string> | null = null;

function darajaTimestamp(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${value.year}${value.month}${value.day}${value.hour}${value.minute}${value.second}`;
}

export class DarajaProvider implements MobileMoneyProvider {
  private baseUrl() { return process.env.MPESA_ENVIRONMENT === "production" ? process.env.MPESA_BASE_URL_PRODUCTION! : process.env.MPESA_BASE_URL_SANDBOX!; }
  private async token() {
    if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) return cachedToken.value;
    tokenRequest ??= (async () => {
      const auth = Buffer.from(`${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`).toString("base64");
      const response = await fetch(`${this.baseUrl()}/oauth/v1/generate?grant_type=client_credentials`, {
        headers: { Authorization: `Basic ${auth}` },
        signal: AbortSignal.timeout(10_000)
      });
      if (!response.ok) {
        const responseBody = (await response.text()).slice(0, 4096);
        throw new DarajaHttpError(`Daraja authentication failed (${response.status})`, response.status, responseBody, "AUTH");
      }
      const body = await response.json() as { access_token?: string; expires_in?: string | number };
      if (!body.access_token) throw new Error("Daraja authentication response did not include an access token");
      const lifetimeSeconds = Math.max(60, Number(body.expires_in) || 3600);
      cachedToken = { value: body.access_token, expiresAt: Date.now() + lifetimeSeconds * 1000 };
      return body.access_token;
    })().finally(() => { tokenRequest = null; });
    return tokenRequest;
  }
  async requestStkPush(input: { phoneE164: string; amountKes: number; accountReference: string; description: string }) {
    const timestamp = darajaTimestamp(); const shortcode = process.env.MPESA_SHORTCODE!; const password = Buffer.from(`${shortcode}${process.env.MPESA_PASSKEY}${timestamp}`).toString("base64");
    const phone = input.phoneE164.replace(/^\+/, "");
    const res = await fetch(`${this.baseUrl()}/mpesa/stkpush/v1/processrequest`, { method: "POST", headers: { Authorization: `Bearer ${await this.token()}`, "Content-Type": "application/json" }, body: JSON.stringify({ BusinessShortCode: shortcode, Password: password, Timestamp: timestamp, TransactionType: "CustomerPayBillOnline", Amount: Math.max(1, Math.trunc(input.amountKes)), PartyA: phone, PartyB: shortcode, PhoneNumber: phone, CallBackURL: process.env.MPESA_CALLBACK_URL, AccountReference: input.accountReference.slice(0, 12), TransactionDesc: input.description.slice(0, 13) }), signal: AbortSignal.timeout(15_000) });
    if (!res.ok) {
      const responseBody = (await res.text()).slice(0, 4096);
      throw new DarajaHttpError(`Daraja STK request failed (${res.status})`, res.status, responseBody, res.status === 401 || res.status === 403 ? "AUTH" : "REQUEST");
    }
    const body = await res.json() as { MerchantRequestID?: string; CheckoutRequestID?: string; ResponseCode?: string; ResponseDescription?: string };
    if (!body.MerchantRequestID || !body.CheckoutRequestID) throw new Error(`Daraja STK response was missing request identifiers: ${JSON.stringify(body).slice(0, 4096)}`);
    return { merchantRequestId: body.MerchantRequestID, checkoutRequestId: body.CheckoutRequestID };
  }
  async queryStkStatus(checkoutRequestId: string) {
    const timestamp = darajaTimestamp();
    const shortcode = process.env.MPESA_SHORTCODE!;
    const password = Buffer.from(`${shortcode}${process.env.MPESA_PASSKEY}${timestamp}`).toString("base64");
    const response = await fetch(`${this.baseUrl()}/mpesa/stkpushquery/v1/query`, {
      method: "POST",
      headers: { Authorization: `Bearer ${await this.token()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ BusinessShortCode: shortcode, Password: password, Timestamp: timestamp, CheckoutRequestID: checkoutRequestId }),
      signal: AbortSignal.timeout(10_000)
    });
    if (!response.ok) throw new Error(`Daraja STK query failed (${response.status})`);
    const body = await response.json() as { ResultCode?: string | number; ResultDesc?: string };
    const resultCode = Number(body.ResultCode);
    if (!Number.isInteger(resultCode)) throw new Error("Daraja STK query returned an invalid result");
    return { resultCode, resultDescription: body.ResultDesc ?? "No result description" };
  }
}
const itemSchema = z.object({ Name: z.string(), Value: z.union([z.string(), z.number()]).optional() });
export const darajaCallbackSchema = z.object({ Body: z.object({ stkCallback: z.object({ MerchantRequestID: z.string(), CheckoutRequestID: z.string(), ResultCode: z.number().int(), ResultDesc: z.string(), CallbackMetadata: z.object({ Item: z.array(itemSchema) }).optional() }) }) });
export type DarajaCallback = z.infer<typeof darajaCallbackSchema>;
export function callbackValue(callback: DarajaCallback, name: string) { return callback.Body.stkCallback.CallbackMetadata?.Item.find(item => item.Name === name)?.Value; }
