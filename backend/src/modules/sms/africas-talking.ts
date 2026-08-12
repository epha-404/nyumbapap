import type { SmsProvider } from "./provider";
export class AfricasTalkingSmsProvider implements SmsProvider {
  async sendOtp(input: { phoneE164: string; code: string; expiresInSeconds: number }) {
    const response = await fetch("https://api.africastalking.com/version1/messaging", { method: "POST", headers: { apiKey: process.env.AFRICASTALKING_API_KEY ?? "", Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ username: process.env.AFRICASTALKING_USERNAME ?? "", to: input.phoneE164, message: `Your NyumbaPap code is ${input.code}. It expires in ${Math.ceil(input.expiresInSeconds / 60)} minutes.`, ...(process.env.AFRICASTALKING_SENDER_ID ? { from: process.env.AFRICASTALKING_SENDER_ID } : {}) }) });
    if (!response.ok) throw new Error(`SMS provider rejected request (${response.status})`);
    const body = await response.json() as { SMSMessageData?: { Recipients?: Array<{ messageId?: string }> } };
    return { providerMessageId: body.SMSMessageData?.Recipients?.[0]?.messageId ?? "unknown" };
  }
}
