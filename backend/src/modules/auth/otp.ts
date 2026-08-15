import { createHmac, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import type { OtpPurpose, UserRole } from "@prisma/client";
import { db } from "@/lib/db";
import { emailProvider, type EmailProvider } from "@/modules/email";
import { ensureAuthTables, normalizeEmail, type AccountRow } from "./accounts";
import { consumeRateLimit, emailRateKey } from "./request-security";
import { Role, roleFromStoredValue, roleToDatabase } from "./roles";

export const OTP_TTL_SECONDS = 5 * 60;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_REQUEST_LIMIT = 3;
export const OTP_REQUEST_WINDOW_SECONDS = 15 * 60;
export const OTP_GENERIC_RESPONSE = "If this email can receive a code, one has been sent.";
export const OTP_GENERIC_ERROR = "The verification code is invalid or unavailable.";

type OtpMode = "LOGIN" | "REGISTER" | "EMAIL_MIGRATION";
type OtpCodeRow = {
  id: string;
  userId: string | null;
  email: string;
  codeHash: string;
  purpose: OtpPurpose;
  displayName: string | null;
  registrationRole: UserRole | null;
  deviceHash: string;
  attemptCount: number;
  maxAttempts: number;
  expiresAt: Date;
  consumedAt: Date | null;
};

export class AuthFlowError extends Error {
  constructor(message: string, public status = 400, public retryAfter?: number) { super(message); }
}

function authSecret() {
  const value = process.env.OTP_HMAC_SECRET;
  if (!value || value.length < 32) throw new Error("OTP_HMAC_SECRET must contain at least 32 characters");
  return value;
}

export function generateOtpCode() {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function hashOtpCode(codeId: string, email: string, code: string) {
  return createHmac("sha256", authSecret()).update(`otp:${codeId}:${normalizeEmail(email)}:${code}`).digest("base64url");
}

export function otpCodeMatches(expected: string, codeId: string, email: string, code: string) {
  const actual = Buffer.from(hashOtpCode(codeId, email, code));
  const stored = Buffer.from(expected);
  return actual.length === stored.length && timingSafeEqual(actual, stored);
}

export function otpIsUnavailable(challenge: Pick<OtpCodeRow, "consumedAt" | "expiresAt" | "attemptCount" | "maxAttempts">, nowMs = Date.now()) {
  return Boolean(challenge.consumedAt) || challenge.expiresAt.getTime() <= nowMs || challenge.attemptCount >= challenge.maxAttempts;
}

export function failedAttempt(attemptCount: number, maxAttempts: number) {
  const nextAttemptCount = attemptCount + 1;
  return { attemptCount: nextAttemptCount, locked: nextAttemptCount >= maxAttempts };
}

async function enforce(action: string, key: string, limit: number, seconds: number) {
  const result = await consumeRateLimit(action, key, limit, seconds);
  if (result.limited) throw new AuthFlowError("Too many requests. Try again later.", 429, result.retryAfter);
  return result;
}

export async function requestOtp(input: {
  mode: OtpMode;
  email: string;
  displayName?: string;
  role?: Extract<Role, "CLIENT" | "LANDLORD" | "AGENT">;
  userId?: string;
  deviceHash: string;
  ipHash: string;
}, provider: EmailProvider = emailProvider()) {
  await ensureAuthTables();
  const email = normalizeEmail(input.email);
  await enforce("otp-request-ip", input.ipHash, 20, 10 * 60);
  await enforce("otp-request-device", input.deviceHash, 10, 10 * 60);

  let userId: string | null = null;
  let displayName = input.displayName?.trim() || null;
  let role: UserRole | null = input.role ? roleToDatabase(input.role) : null;
  let purpose: OtpPurpose = input.mode === "LOGIN" ? "LOGIN" : input.mode === "EMAIL_MIGRATION" ? "EMAIL_MIGRATION" : "SIGNUP";
  const existing = await db.user.findUnique({ where: { email } });

  if (input.mode === "EMAIL_MIGRATION") {
    if (!input.userId || existing) return { message: OTP_GENERIC_RESPONSE, expiresInSeconds: OTP_TTL_SECONDS, cooldownSeconds: 300 };
    const user = await db.user.findUnique({ where: { id: input.userId } });
    const account = user ? await db.appAccount.findUnique({ where: { id: user.id } }) as AccountRow | null : null;
    if (!user || !account || !user.requiresEmailCapture) return { message: OTP_GENERIC_RESPONSE, expiresInSeconds: OTP_TTL_SECONDS, cooldownSeconds: 300 };
    userId = user.id;
    displayName = account.displayName;
    role = user.role;
  } else if (input.mode === "LOGIN") {
    if (!existing) {
      return {
        message: "Complete registration before requesting a verification code.",
        registrationRequired: true,
        expiresInSeconds: 0,
        cooldownSeconds: 0
      };
    } else if (existing.status !== "ACTIVE") {
      return { message: OTP_GENERIC_RESPONSE, expiresInSeconds: OTP_TTL_SECONDS, cooldownSeconds: 300 };
    } else {
      const account = await db.appAccount.findUnique({ where: { id: existing.id } }) as AccountRow | null;
      if (!account) return { message: OTP_GENERIC_RESPONSE, expiresInSeconds: OTP_TTL_SECONDS, cooldownSeconds: 300 };
      userId = existing.id;
      displayName = account.displayName;
      role = existing.role;
    }
  } else {
    if (!displayName || displayName.length < 2 || displayName.length > 80 || !role) throw new AuthFlowError("Enter your name and account type.");
    if (existing?.status === "ACTIVE") return {
      message: "This email already has an account. Sign in to continue.",
      loginRequired: true,
      expiresInSeconds: 0,
      cooldownSeconds: 0
    };
    if (existing) return { message: OTP_GENERIC_RESPONSE, expiresInSeconds: OTP_TTL_SECONDS, cooldownSeconds: 300 };
  }

  const emailLimit = await enforce("otp-request-email", emailRateKey(email), OTP_REQUEST_LIMIT, OTP_REQUEST_WINDOW_SECONDS);
  await db.otpCode.updateMany({ where: { email, purpose, consumedAt: null }, data: { consumedAt: new Date() } });
  const id = randomUUID();
  const code = generateOtpCode();
  await db.otpCode.create({ data: {
    id,
    userId,
    email,
    codeHash: hashOtpCode(id, email, code),
    purpose,
    displayName,
    registrationRole: role,
    deviceHash: input.deviceHash,
    attemptCount: 0,
    maxAttempts: OTP_MAX_ATTEMPTS,
    expiresAt: new Date(Date.now() + OTP_TTL_SECONDS * 1000)
  } });
  try {
    const sent = await provider.sendOtp({ to: email, code, expiresInSeconds: OTP_TTL_SECONDS });
    await db.otpCode.update({ where: { id }, data: { providerMessageId: sent.providerMessageId } });
  } catch (error) {
    await db.otpCode.update({ where: { id }, data: { consumedAt: new Date() } });
    throw new AuthFlowError("Could not send a verification code. Try again later.", 502);
  }
  return { message: OTP_GENERIC_RESPONSE, expiresInSeconds: OTP_TTL_SECONDS, cooldownSeconds: Math.min(300, emailLimit.retryAfter) };
}

export async function verifyOtp(input: { email: string; code: string; deviceHash: string; ipHash: string }) {
  await ensureAuthTables();
  const email = normalizeEmail(input.email);
  await enforce("otp-verify-ip", input.ipHash, 30, 15 * 60);
  await enforce("otp-verify-device", input.deviceHash, 20, 15 * 60);

  const result = await db.$transaction(async (tx) => {
    const challenge = await tx.otpCode.findFirst({ where: { email }, orderBy: { createdAt: "desc" } }) as OtpCodeRow | null;
    const invalid = !challenge || otpIsUnavailable(challenge) || challenge.deviceHash !== input.deviceHash;
    if (invalid) {
      if (challenge && !challenge.consumedAt && challenge.expiresAt.getTime() <= Date.now()) {
        await tx.otpCode.update({ where: { id: challenge.id }, data: { consumedAt: new Date() } });
      }
      return { ok: false as const };
    }
    if (!otpCodeMatches(challenge.codeHash, challenge.id, challenge.email, input.code)) {
      const failed = failedAttempt(challenge.attemptCount, challenge.maxAttempts);
      await tx.otpCode.update({ where: { id: challenge.id }, data: { attemptCount: failed.attemptCount, ...(failed.locked ? { consumedAt: new Date() } : {}) } });
      return { ok: false as const };
    }

    const now = new Date();
    await tx.otpCode.update({ where: { id: challenge.id }, data: { consumedAt: now } });
    if (challenge.purpose === "LOGIN" || challenge.purpose === "EMAIL_MIGRATION") {
      if (!challenge.userId) return { ok: false as const };
      const user = await tx.user.findUnique({ where: { id: challenge.userId } });
      if (!user || user.status !== "ACTIVE") return { ok: false as const };
      const role = roleFromStoredValue(user.role);
      await tx.user.update({ where: { id: user.id }, data: { email: challenge.email, emailVerifiedAt: user.emailVerifiedAt ?? now, requiresEmailCapture: false } });
      await tx.notificationOutbox.upsert({ where: { dedupeKey: `security-login:${challenge.id}` }, create: { recipientId: user.id, topic: "SECURITY_LOGIN", dedupeKey: `security-login:${challenge.id}`, payload: { signedInAt: now.toISOString() } }, update: {} });
      return { ok: true as const, user: { userId: user.id, role, displayName: challenge.displayName ?? "NyumbaPap user" } };
    }

    if (challenge.purpose !== "SIGNUP") return { ok: false as const };
    try {
      const user = await tx.user.create({ data: {
        email: challenge.email,
        emailVerifiedAt: now,
        role: challenge.registrationRole ?? "TENANT",
        status: "ACTIVE",
        verifiedAt: now
      } });
      const name = challenge.displayName ?? "NyumbaPap user";
      await tx.appAccount.create({ data: { id: user.id, displayName: name } });
      if (user.role === "LANDLORD") await tx.landlordProfile.create({ data: { userId: user.id, displayName: name } });
      if (user.role === "AGENT") await tx.agentProfile.create({ data: { userId: user.id, agencyName: name } });
      const role = roleFromStoredValue(user.role);
      return { ok: true as const, user: { userId: user.id, role, displayName: name } };
    } catch (error) {
      if (String(error).includes("Unique constraint")) return { ok: false as const };
      throw error;
    }
  });
  if (!result.ok) throw new AuthFlowError(OTP_GENERIC_ERROR, 400);
  return result.user;
}

export function requestEmailMigrationOtp(input: { email: string; userId: string; deviceHash: string; ipHash: string }, provider?: EmailProvider) {
  return requestOtp({ mode: "EMAIL_MIGRATION", ...input }, provider);
}
