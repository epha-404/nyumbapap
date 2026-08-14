import "dotenv/config";
import { createDecipheriv } from "node:crypto";
import { Binary, MongoClient } from "mongodb";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function decrypt(payload: Binary | Buffer, keyBase64: string) {
  const bytes = Buffer.isBuffer(payload) ? payload : Buffer.from(payload.buffer);
  const key = Buffer.from(keyBase64, "base64");
  if (bytes[0] !== 1 || key.length !== 32) throw new Error("Unsupported encrypted email payload");
  const decipher = createDecipheriv("aes-256-gcm", key, bytes.subarray(1, 13));
  decipher.setAuthTag(bytes.subarray(13, 29));
  return Buffer.concat([decipher.update(bytes.subarray(29)), decipher.final()]).toString("utf8").trim().toLowerCase();
}

async function main() {
  const url = process.env.DATABASE_URL;
  const encryptionKey = process.env.FIELD_ENCRYPTION_KEY_BASE64;
  if (!url) throw new Error("DATABASE_URL is required");
  const client = new MongoClient(url);
  await client.connect();
  try {
    const users = client.db().collection("users");
    const cursor = users.find({ $or: [{ email: { $exists: false } }, { email: null }] });
    let recovered = 0;
    let requiresCapture = 0;
    for await (const user of cursor) {
      let email: string | null = null;
      if (user.email_encrypted && encryptionKey) {
        try {
          const candidate = decrypt(user.email_encrypted, encryptionKey);
          if (candidate.length <= 254 && emailPattern.test(candidate) && !(await users.findOne({ email: candidate }))) email = candidate;
        } catch { /* A missing/legacy key must not abort migration of every account. */ }
      }
      if (email) {
        await users.updateOne({ _id: user._id }, { $set: { email, email_verified_at: user.verified_at ?? null, requires_email_capture: false } });
        recovered += 1;
      } else {
        await users.updateOne({ _id: user._id }, { $set: { email: `pending-${String(user._id)}@migration.invalid`, email_verified_at: null, requires_email_capture: true } });
        requiresCapture += 1;
      }
    }
    await users.createIndex({ email: 1 }, { unique: true, name: "users_email_key" });
    console.log(JSON.stringify({ recovered, requiresCapture }));
  } finally {
    await client.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
