import { createHmac, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import type { UserRole } from "@prisma/client";
import { db } from "@/lib/db";
import { decryptField, encryptField } from "@/lib/crypto";
import { ensureAuthTables, hashPhone, normalizePhone, type AccountRow } from "./accounts";
import { consumeRateLimit, phoneRateKey } from "./request-security";
import { smsProvider } from "@/modules/sms";
import { Role, roleFromStoredValue, roleToDatabase } from "./roles";

const OTP_TTL_SECONDS = 5 * 60;
const OTP_ATTEMPTS = 5;

type OtpMode = "LOGIN" | "REGISTER";
type OtpChallengeRow = {
  id: string;
  phoneHash: string;
  phoneEncrypted: Buffer;
  codeHash: string;
  mode: OtpMode;
  userId: string | null;
  displayName: string | null;
  registrationRole: UserRole | null;
  deviceHash: string;
  attemptsRemaining: number;
  expiresAt: Date;
  consumedAt: Date | null;
};

export class AuthFlowError extends Error {
  constructor(message: string, public status = 400, public retryAfter?: number) { super(message); }
}

function authSecret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) throw new Error("SESSION_SECRET must contain at least 32 characters");
  return value;
}

export function hashOtpCode(challengeId: string, phoneHash: string, code: string) {
  return createHmac("sha256", authSecret()).update(`otp:${challengeId}:${phoneHash}:${code}`).digest("base64url");
}

export function otpCodeMatches(expected: string, challengeId: string, phoneHash: string, code: string) {
  const actual = Buffer.from(hashOtpCode(challengeId, phoneHash, code));
  const stored = Buffer.from(expected);
  return actual.length === stored.length && timingSafeEqual(actual, stored);
}

async function enforce(action: string, key: string, limit: number, seconds: number) {
  const result = await consumeRateLimit(action, key, limit, seconds);
  if (result.limited) throw new AuthFlowError("Too many attempts. Try again later.", 429, result.retryAfter);
}

function encryptionKey() {
  const key = process.env.FIELD_ENCRYPTION_KEY_BASE64;
  if (!key) throw new Error("FIELD_ENCRYPTION_KEY_BASE64 is required");
  return key;
}

export async function requestOtp(input: {
  mode: OtpMode;
  phone: string;
  displayName?: string;
  role?: Role.CLIENT | Role.LANDLORD | Role.AGENT;
  deviceHash: string;
  ipHash: string;
}) {
  await ensureAuthTables();
  const phone = normalizePhone(input.phone);
  const phoneDigest = hashPhone(phone);
  await enforce("otp-request-ip", input.ipHash, 20, 10 * 60);
  await enforce("otp-request-device", input.deviceHash, 10, 10 * 60);
  await enforce("otp-request-phone", phoneRateKey(phoneDigest), 5, 60 * 60);

  const recent = await db.authOtpChallenge.findFirst({ where: { phoneHash: phoneDigest, mode: input.mode, createdAt: { gt: new Date(Date.now() - 60_000) }, consumedAt: null }, select: { id: true } });
  if (recent) throw new AuthFlowError("Please wait before requesting another code.", 429, 60);

  let userId: string | null = null;
  let displayName = input.displayName?.trim() || null;
  let role: UserRole | null = input.role ? roleToDatabase(input.role) : null;
  if (input.mode === "LOGIN") {
    const user = await db.user.findFirst({ where: { phoneHash: phoneDigest } });
    if (!user || user.status !== "ACTIVE") throw new AuthFlowError("No active account exists for this phone number.", 404);
    const account = await db.appAccount.findUnique({ where: { id: user.id } }) as AccountRow | null;
    if (!account) throw new AuthFlowError("Account setup is incomplete.", 409);
    userId = user.id;
    displayName = account.displayName;
    role = user.role;
  } else {
    if (!displayName || displayName.length < 2 || displayName.length > 80 || !role) throw new AuthFlowError("Enter your name and account type.");
    if (await db.user.findFirst({ where: { phoneHash: phoneDigest }, select: { id: true } })) {
      throw new AuthFlowError("An account already exists for this phone number.", 409);
    }
  }

  await db.authOtpChallenge.updateMany({ where: { phoneHash: phoneDigest, mode: input.mode, consumedAt: null }, data: { consumedAt: new Date() } });
  const challengeId = randomUUID();
  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  const codeHash = hashOtpCode(challengeId, phoneDigest, code);
  const phoneEncrypted = encryptField(phone, encryptionKey());
  await db.authOtpChallenge.create({ data: { id: challengeId, phoneHash: phoneDigest, phoneEncrypted, codeHash, mode: input.mode, userId, displayName, registrationRole: role, deviceHash: input.deviceHash, ipHash: input.ipHash, attemptsRemaining: OTP_ATTEMPTS, expiresAt: new Date(Date.now() + OTP_TTL_SECONDS * 1000) } });
  try {
    const sent = await smsProvider().sendOtp({ phoneE164: phone, code, expiresInSeconds: OTP_TTL_SECONDS });
    await db.authOtpChallenge.update({ where: { id: challengeId }, data: { providerMessageId: sent.providerMessageId } });
  } catch (error) {
    await db.authOtpChallenge.update({ where: { id: challengeId }, data: { consumedAt: new Date() } });
    throw error;
  }
  return { challengeId, expiresInSeconds: OTP_TTL_SECONDS };
}

export async function verifyOtp(input: { challengeId: string; code: string; deviceHash: string; ipHash: string }) {
  await ensureAuthTables();
  await enforce("otp-verify-ip", input.ipHash, 30, 15 * 60);
  await enforce("otp-verify-device", input.deviceHash, 20, 15 * 60);

  const result = await db.$transaction(async (tx) => {
    const challenge = await tx.authOtpChallenge.findUnique({ where: { id: input.challengeId } }) as OtpChallengeRow | null;
    if (!challenge || challenge.consumedAt) return { ok: false as const, error: "This code is invalid or has already been used.", status: 400 };
    if (challenge.expiresAt.getTime() <= Date.now()) {
      await tx.authOtpChallenge.update({ where: { id: input.challengeId }, data: { consumedAt: new Date() } });
      return { ok: false as const, error: "This code has expired. Request a new one.", status: 400 };
    }
    if (challenge.attemptsRemaining <= 0) return { ok: false as const, error: "Too many incorrect attempts. Request a new code.", status: 429 };
    if (challenge.deviceHash !== input.deviceHash || !otpCodeMatches(challenge.codeHash, challenge.id, challenge.phoneHash, input.code)) {
      const remaining = challenge.attemptsRemaining - 1;
      await tx.authOtpChallenge.update({ where: { id: input.challengeId }, data: { attemptsRemaining: remaining, ...(remaining <= 0 ? { consumedAt: new Date() } : {}) } });
      return { ok: false as const, error: remaining > 0 ? `Incorrect code. ${remaining} attempts remaining.` : "Too many incorrect attempts. Request a new code.", status: remaining > 0 ? 401 : 429 };
    }
    await tx.authOtpChallenge.update({ where: { id: input.challengeId }, data: { consumedAt: new Date(), attemptsRemaining: 0 } });

    if (challenge.mode === "LOGIN") {
      if (!challenge.userId) throw new AuthFlowError("Account not found.", 404);
      const user = await tx.user.findUnique({ where: { id: challenge.userId } });
      if (!user || user.status !== "ACTIVE") throw new AuthFlowError("Account is not active.", 403);
      const role = roleFromStoredValue(user.role);
      if (!role) throw new AuthFlowError("Account role is not supported.", 403);
      return { ok: true as const, user: { userId: user.id, role, displayName: challenge.displayName ?? "NyumbaPap user" } };
    }

    const phone = decryptField(challenge.phoneEncrypted, encryptionKey());
    try {
      const user = await tx.user.create({ data: {
        phoneHash: challenge.phoneHash,
        phoneEncrypted: encryptField(phone, encryptionKey()),
        role: challenge.registrationRole ?? "TENANT",
        status: "ACTIVE",
        verifiedAt: new Date()
      } });
      const name = challenge.displayName ?? "NyumbaPap user";
      await tx.appAccount.create({ data: { id: user.id, displayName: name } });
      if (user.role === "LANDLORD") await tx.landlordProfile.create({ data: { userId: user.id, displayName: name } });
      if (user.role === "AGENT") await tx.agentProfile.create({ data: { userId: user.id, agencyName: name } });
      const role = roleFromStoredValue(user.role);
      if (!role) throw new AuthFlowError("Account role is not supported.", 403);
      return { ok: true as const, user: { userId: user.id, role, displayName: name } };
    } catch (error) {
      if (String(error).includes("Unique constraint")) throw new AuthFlowError("An account already exists for this phone number.", 409);
      throw error;
    }
  });
  if (!result.ok) throw new AuthFlowError(result.error, result.status);
  return result.user;
}
