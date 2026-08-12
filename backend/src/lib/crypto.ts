import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

export function blindIndex(value: string, pepper: string): string {
  return createHash("sha256").update(`${pepper}:${value.trim().toLowerCase()}`).digest("hex");
}
export function encryptField(value: string, keyBase64: string): Buffer {
  const key = Buffer.from(keyBase64, "base64");
  if (key.length !== 32) throw new Error("FIELD_ENCRYPTION_KEY_BASE64 must decode to 32 bytes");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return Buffer.concat([Buffer.from([1]), iv, cipher.getAuthTag(), ciphertext]);
}
export function decryptField(payload: Buffer, keyBase64: string): string {
  const key = Buffer.from(keyBase64, "base64");
  const iv = payload.subarray(1, 13); const tag = payload.subarray(13, 29); const ciphertext = payload.subarray(29);
  const decipher = createDecipheriv("aes-256-gcm", key, iv); decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
