import { NesEmailProvider } from "./nes";
import type { EmailProvider } from "./provider";

export type { EmailProvider, OtpEmail } from "./provider";

export function emailProvider(): EmailProvider {
  return new NesEmailProvider();
}
