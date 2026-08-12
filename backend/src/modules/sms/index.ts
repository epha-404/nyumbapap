import { AfricasTalkingSmsProvider } from "./africas-talking";
import { ConsoleSmsProvider, type SmsProvider } from "./provider";

export function smsProvider(): SmsProvider {
  if (process.env.NODE_ENV !== "production") return new ConsoleSmsProvider();
  const apiKey = process.env.AFRICASTALKING_API_KEY?.trim();
  const username = process.env.AFRICASTALKING_USERNAME?.trim();
  if (!apiKey || !username || apiKey.startsWith("replace-with") || username.startsWith("replace-with")) {
    throw new Error("SMS delivery is not configured");
  }
  return new AfricasTalkingSmsProvider();
}
