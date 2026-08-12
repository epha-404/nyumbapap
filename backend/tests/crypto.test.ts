import { describe, expect, it } from "vitest";
import { blindIndex, decryptField, encryptField } from "@/lib/crypto";
describe("protected fields", () => {
  it("round-trips authenticated encryption without storing plaintext", () => { const key = Buffer.alloc(32, 7).toString("base64"); const encrypted = encryptField("Exact address", key); expect(encrypted.toString()).not.toContain("Exact address"); expect(decryptField(encrypted, key)).toBe("Exact address"); });
  it("normalizes blind indexes", () => expect(blindIndex(" USER@Example.COM ", "pepper")).toBe(blindIndex("user@example.com", "pepper")));
});
