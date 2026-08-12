import { describe, expect, it } from "vitest";
import { parseServerEnv } from "@/lib/env";
const valid = { NODE_ENV: "test", APP_URL: "http://localhost:3000", DATABASE_URL: "postgresql://localhost/test", SESSION_SECRET: "x".repeat(32), FIELD_ENCRYPTION_KEY_BASE64: Buffer.alloc(32).toString("base64"), MPESA_CONSUMER_KEY: "key", MPESA_CONSUMER_SECRET: "secret", MPESA_SHORTCODE: "174379", MPESA_PASSKEY: "passkey", MPESA_CALLBACK_URL: "https://example.com/api/webhooks/mpesa" };
describe("environment validation", () => {
  it("accepts safe required configuration", () => expect(parseServerEnv(valid as NodeJS.ProcessEnv).IMAGE_WEBP_QUALITY).toBe(78));
  it("rejects short session secrets", () => expect(() => parseServerEnv({ ...valid, SESSION_SECRET: "short" } as NodeJS.ProcessEnv)).toThrow());
  it("rejects invalid image limits", () => expect(() => parseServerEnv({ ...valid, IMAGE_MAX_DIMENSION: "99999" } as NodeJS.ProcessEnv)).toThrow());
  it("rejects missing Daraja credentials and non-HTTPS callbacks", () => {
    expect(() => parseServerEnv({ ...valid, MPESA_PASSKEY: "" } as NodeJS.ProcessEnv)).toThrow();
    expect(() => parseServerEnv({ ...valid, MPESA_CALLBACK_URL: "http://example.com/api/webhooks/mpesa" } as NodeJS.ProcessEnv)).toThrow();
  });
});
