import { describe, expect, it } from "vitest";
import { badgeFor, BADGE_DEFINITIONS, verificationExpiresAt, VerificationKind } from "@/modules/verification/policy";

describe("verification badge policy", () => {
  it("defines explicit expiry and warning windows for every verification kind", () => {
    expect(Object.keys(BADGE_DEFINITIONS).sort()).toEqual(Object.values(VerificationKind).sort());
    expect(BADGE_DEFINITIONS[VerificationKind.LANDLORD_IDENTITY]).toMatchObject({ validDays: 365, expiringSoonDays: 30 });
    expect(BADGE_DEFINITIONS[VerificationKind.LISTING]).toMatchObject({ validDays: 90, expiringSoonDays: 14 });
  });
  it("moves an approved badge through verified, expiring, and expired states", () => {
    const reviewedAt = new Date("2026-01-01T00:00:00.000Z");
    const expiry = verificationExpiresAt(VerificationKind.LISTING, reviewedAt);
    expect(expiry.toISOString()).toBe("2026-04-01T00:00:00.000Z");
    expect(badgeFor(VerificationKind.LISTING, "APPROVED", expiry, new Date("2026-03-01T00:00:00.000Z")).state).toBe("verified");
    expect(badgeFor(VerificationKind.LISTING, "APPROVED", expiry, new Date("2026-03-25T00:00:00.000Z")).state).toBe("expiring");
    expect(badgeFor(VerificationKind.LISTING, "APPROVED", expiry, expiry).state).toBe("expired");
  });
  it("never presents pending or rejected records as verified", () => {
    expect(badgeFor(VerificationKind.AGENT_LICENSE, "PENDING", null).state).toBe("pending");
    expect(badgeFor(VerificationKind.AGENT_LICENSE, "REJECTED", null).state).toBe("rejected");
  });
});
