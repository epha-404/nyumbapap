import { beforeEach, describe, expect, it } from "vitest";
import { signLifecycleAction, verifyLifecycleAction } from "@/modules/listings/action-tokens";

describe("lifecycle action links", () => {
  beforeEach(() => { process.env.LIFECYCLE_ACTION_SECRET = "test-lifecycle-secret-that-is-at-least-32-characters"; });
  it("verifies an unmodified time-bound token", () => {
    const input = { kind: "TENANT_AVAILABILITY" as const, reportId: "report-1", response: "STILL_AVAILABLE" as const, expiresAt: 2_000 };
    expect(verifyLifecycleAction(signLifecycleAction(input), 1_999)).toEqual(input);
  });
  it("rejects tampering and the exact expiry boundary", () => {
    const token = signLifecycleAction({ kind: "LANDLORD_CONFIRMATION", listingId: "listing-1", pendingSince: new Date(0).toISOString(), expiresAt: 2_000 });
    expect(verifyLifecycleAction(`${token}x`, 1_000)).toBeNull();
    expect(verifyLifecycleAction(token, 2_000)).toBeNull();
  });
});
