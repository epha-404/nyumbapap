import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const state = { users: new Map<string, any>(), accounts: new Map<string, any>(), codes: [] as any[], limited: false };
  const db: any = {
    authRateLimit: { findFirst: vi.fn().mockResolvedValue(null) },
    user: {
      findUnique: vi.fn(async ({ where }: any) => where.email ? [...state.users.values()].find(user => user.email === where.email) ?? null : state.users.get(where.id) ?? null),
      create: vi.fn(async ({ data }: any) => { const user = { id: `user-${state.users.size + 1}`, ...data }; state.users.set(user.id, user); return user; }),
      update: vi.fn(async ({ where, data }: any) => { const user = state.users.get(where.id); Object.assign(user, data); return user; })
    },
    appAccount: {
      findUnique: vi.fn(async ({ where }: any) => state.accounts.get(where.id) ?? null),
      create: vi.fn(async ({ data }: any) => { state.accounts.set(data.id, data); return data; })
    },
    otpCode: {
      updateMany: vi.fn(async ({ where, data }: any) => { state.codes.filter(code => code.email === where.email && code.purpose === where.purpose && code.consumedAt === null).forEach(code => Object.assign(code, data)); return { count: 1 }; }),
      create: vi.fn(async ({ data }: any) => { const row = { createdAt: new Date(), consumedAt: null, providerMessageId: null, ...data }; state.codes.push(row); return row; }),
      update: vi.fn(async ({ where, data }: any) => { const row = state.codes.find(code => code.id === where.id); Object.assign(row, data); return row; }),
      findFirst: vi.fn(async ({ where }: any) => state.codes.filter(code => code.email === where.email).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] ?? null)
    },
    landlordProfile: { create: vi.fn() },
    agentProfile: { create: vi.fn() },
    notificationOutbox: { upsert: vi.fn() },
    $transaction: vi.fn(async (fn: any) => fn(db))
  };
  return { state, db, consumeRateLimit: vi.fn(async () => ({ limited: state.limited, retryAfter: 900 })) };
});

vi.mock("@/lib/db", () => ({ db: mocks.db }));
vi.mock("@/modules/auth/request-security", () => ({
  consumeRateLimit: mocks.consumeRateLimit,
  emailRateKey: (email: string) => `email:${email}`
}));

import { AuthFlowError, OTP_GENERIC_ERROR, requestOtp, verifyOtp } from "@/modules/auth/otp";
import { createSessionToken, readSessionToken } from "@/modules/auth/session";

describe("email OTP signup and verification", () => {
  beforeEach(() => {
    mocks.state.users.clear(); mocks.state.accounts.clear(); mocks.state.codes.length = 0; mocks.state.limited = false;
    vi.clearAllMocks();
    process.env.SESSION_SECRET = "test-session-secret-that-is-at-least-32-characters";
    process.env.OTP_HMAC_SECRET = "test-otp-hmac-secret-that-is-at-least-32-characters";
  });

  it("sends through the provider, verifies, creates the account, and returns a session principal", async () => {
    let deliveredCode = "";
    const provider = { sendOtp: vi.fn(async ({ code }: { code: string }) => { deliveredCode = code; return { providerMessageId: "nes-1" }; }) };
    const response = await requestOtp({ mode: "REGISTER", email: "New.User@Example.com", displayName: "Amina", role: "CLIENT" as any, deviceHash: "device", ipHash: "ip" }, provider);
    expect(response.message).toContain("If this email");
    expect(provider.sendOtp).toHaveBeenCalledWith(expect.objectContaining({ to: "new.user@example.com", expiresInSeconds: 300 }));
    const principal = await verifyOtp({ email: "new.user@example.com", code: deliveredCode, deviceHash: "device", ipHash: "ip" });
    expect(principal).toMatchObject({ userId: "user-1", displayName: "Amina" });
    expect(readSessionToken(createSessionToken(principal))).toEqual(principal);
    expect(mocks.state.users.get("user-1")).toMatchObject({ email: "new.user@example.com", emailVerifiedAt: expect.any(Date), status: "ACTIVE" });
    expect(mocks.state.codes[0].consumedAt).toBeInstanceOf(Date);
  });

  it("routes an unregistered login email to registration without creating a tenant or sending OTP", async () => {
    const provider = { sendOtp: vi.fn(async () => ({ providerMessageId: "must-not-send" })) };
    const result = await requestOtp({ mode: "LOGIN", email: "first.visit@example.com", deviceHash: "device", ipHash: "ip" }, provider);
    expect(result).toMatchObject({ registrationRequired: true, cooldownSeconds: 0 });
    expect(provider.sendOtp).not.toHaveBeenCalled();
    expect(mocks.state.users.size).toBe(0);
    expect(mocks.state.codes).toHaveLength(0);
  });

  it("routes an existing active registration email back to sign-in without sending a signup OTP", async () => {
    mocks.state.users.set("existing-1", { id: "existing-1", email: "known@example.com", status: "ACTIVE", role: "TENANT" });
    mocks.state.accounts.set("existing-1", { id: "existing-1", displayName: "Known user" });
    const provider = { sendOtp: vi.fn(async () => ({ providerMessageId: "must-not-send" })) };
    const result = await requestOtp({ mode: "REGISTER", email: "known@example.com", displayName: "Duplicate", role: "CLIENT" as any, deviceHash: "device", ipHash: "ip" }, provider);
    expect(result).toMatchObject({ loginRequired: true, cooldownSeconds: 0 });
    expect(provider.sendOtp).not.toHaveBeenCalled();
    expect(mocks.state.codes).toHaveLength(0);
  });

  it("returns the same generic error for wrong and expired codes", async () => {
    const provider = { sendOtp: vi.fn(async () => ({ providerMessageId: "nes-1" })) };
    await requestOtp({ mode: "REGISTER", email: "new@example.com", displayName: "Amina", role: "CLIENT" as any, deviceHash: "device", ipHash: "ip" }, provider);
    await expect(verifyOtp({ email: "new@example.com", code: "999999", deviceHash: "device", ipHash: "ip" })).rejects.toMatchObject({ message: OTP_GENERIC_ERROR });
    mocks.state.codes[0].expiresAt = new Date(Date.now() - 1);
    await expect(verifyOtp({ email: "new@example.com", code: "999999", deviceHash: "device", ipHash: "ip" })).rejects.toMatchObject({ message: OTP_GENERIC_ERROR });
  });

  it("locks after five wrong codes without leaking remaining attempts", async () => {
    const provider = { sendOtp: vi.fn(async () => ({ providerMessageId: "nes-1" })) };
    await requestOtp({ mode: "REGISTER", email: "lock@example.com", displayName: "Amina", role: "CLIENT" as any, deviceHash: "device", ipHash: "ip" }, provider);
    for (let attempt = 0; attempt < 5; attempt++) {
      await expect(verifyOtp({ email: "lock@example.com", code: "999999", deviceHash: "device", ipHash: "ip" })).rejects.toMatchObject({ message: OTP_GENERIC_ERROR });
    }
    expect(mocks.state.codes[0]).toMatchObject({ attemptCount: 5, consumedAt: expect.any(Date) });
  });

  it("rejects exceeded resend rate and malformed email", async () => {
    mocks.state.limited = true;
    await expect(requestOtp({ mode: "LOGIN", email: "person@example.com", deviceHash: "device", ipHash: "ip" })).rejects.toMatchObject({ status: 429 });
    mocks.state.limited = false;
    await expect(requestOtp({ mode: "LOGIN", email: "not-an-email", deviceHash: "device", ipHash: "ip" })).rejects.toBeInstanceOf(Error);
  });
});
