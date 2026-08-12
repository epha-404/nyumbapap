export interface SmsProvider { sendOtp(input: { phoneE164: string; code: string; expiresInSeconds: number }): Promise<{ providerMessageId: string }> }
export class ConsoleSmsProvider implements SmsProvider {
  async sendOtp(input: { phoneE164: string; code: string; expiresInSeconds: number }) {
    if (process.env.NODE_ENV === "production") throw new Error("ConsoleSmsProvider is disabled in production");
    console.info("Development OTP", { phone: input.phoneE164.slice(-4), code: input.code, expiresInSeconds: input.expiresInSeconds });
    return { providerMessageId: `console-${Date.now()}` };
  }
}
