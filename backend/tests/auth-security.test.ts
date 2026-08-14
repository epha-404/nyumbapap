import { beforeEach, describe, expect, it } from "vitest";
import { createCsrfToken, CSRF_COOKIE, verifyCsrfRequest } from "@/modules/auth/request-security";
import { failedAttempt, generateOtpCode, hashOtpCode, otpCodeMatches, otpIsUnavailable } from "@/modules/auth/otp";
import { createSessionToken, readSessionToken } from "@/modules/auth/session";
import { Role } from "@/modules/auth/roles";

describe("authentication security", () => {
  beforeEach(() => {
    process.env.SESSION_SECRET = "test-session-secret-that-is-at-least-32-characters";
    process.env.OTP_HMAC_SECRET = "test-otp-hmac-secret-that-is-at-least-32-characters";
  });

  it("stores comparable OTP hashes without exposing the code", () => {
    const hash = hashOtpCode("challenge", "user@example.com", "123456");
    expect(hash).not.toContain("123456");
    expect(otpCodeMatches(hash, "challenge", "user@example.com", "123456")).toBe(true);
    expect(otpCodeMatches(hash, "challenge", "user@example.com", "654321")).toBe(false);
  });

  it("generates varied six-digit numeric codes with the CSPRNG helper", () => {
    const codes = Array.from({ length: 500 }, generateOtpCode);
    expect(codes.every(code => /^\d{6}$/.test(code))).toBe(true);
    expect(new Set(codes).size).toBeGreaterThan(490);
  });

  it("treats the exact expiry boundary as unavailable", () => {
    const expiresAt = new Date("2026-08-14T12:00:00.000Z");
    const challenge = { expiresAt, consumedAt: null, attemptCount: 0, maxAttempts: 5 };
    expect(otpIsUnavailable(challenge, expiresAt.getTime() - 1)).toBe(false);
    expect(otpIsUnavailable(challenge, expiresAt.getTime())).toBe(true);
  });

  it("locks the code on the fifth failed attempt", () => {
    expect(failedAttempt(3, 5)).toEqual({ attemptCount: 4, locked: false });
    expect(failedAttempt(4, 5)).toEqual({ attemptCount: 5, locked: true });
  });

  it("requires a matching signed double-submit CSRF token", () => {
    const token = createCsrfToken();
    const valid = new Request("http://localhost:3001/api/auth/logout", { method: "POST", headers: {
      origin: "http://localhost:3001",
      cookie: `${CSRF_COOKIE}=${token}`,
      "x-csrf-token": token
    } });
    const invalid = new Request("http://localhost:3001/api/auth/logout", { method: "POST", headers: {
      origin: "http://localhost:3001",
      cookie: `${CSRF_COOKIE}=${token}`,
      "x-csrf-token": "wrong"
    } });
    expect(verifyCsrfRequest(valid)).toBe(true);
    expect(verifyCsrfRequest(invalid)).toBe(false);
  });

  it("accepts a signed CSRF token from any configured frontend origin", () => {
    process.env.FRONTEND_URLS = "http://localhost:3000,http://100.83.243.1:3000";
    const token = createCsrfToken();
    const request = new Request("http://localhost:3001/api/auth/otp/request", { method: "POST", headers: {
      origin: "http://100.83.243.1:3000",
      cookie: `${CSRF_COOKIE}=${token}`,
      "x-csrf-token": token
    } });
    expect(verifyCsrfRequest(request)).toBe(true);
    delete process.env.FRONTEND_URLS;
  });

  it("signs and validates session payloads", () => {
    const user = { userId: "user-1", role: Role.CLIENT, displayName: "Amina" };
    expect(readSessionToken(createSessionToken(user))).toEqual(user);
  });
});
