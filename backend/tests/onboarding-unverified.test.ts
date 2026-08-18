import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  profileFind: vi.fn(),
  profileUpdate: vi.fn(),
  recordFind: vi.fn(),
  auditCreate: vi.fn(),
  ensureAudit: vi.fn()
}));

vi.mock("@/lib/db", () => ({
  db: {
    landlordProfile: { findUnique: mocks.profileFind },
    verificationRecord: { findFirst: mocks.recordFind },
    $transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback({
      landlordProfile: { update: mocks.profileUpdate },
      auditEvent: { create: mocks.auditCreate }
    })
  }
}));
vi.mock("@/modules/verification/audit", () => ({ ensureAuditEventsImmutable: mocks.ensureAudit }));

import { POST } from "@/app/api/onboarding/decline-document/route";
import { createCsrfToken, CSRF_COOKIE } from "@/modules/auth/request-security";
import { createSessionToken, SESSION_COOKIE } from "@/modules/auth/session";
import { Role } from "@/modules/auth/roles";

function landlordRequest() {
  const csrf = createCsrfToken();
  const session = createSessionToken({ userId: "landlord-1", role: Role.LANDLORD, displayName: "Amina" });
  return new Request("http://localhost:3001/api/onboarding/decline-document", {
    method: "POST",
    headers: {
      origin: "http://localhost:3001",
      cookie: `${SESSION_COOKIE}=${session}; ${CSRF_COOKIE}=${csrf}`,
      "x-csrf-token": csrf
    }
  });
}

describe("landlord unverified opt-out", () => {
  beforeEach(() => {
    process.env.SESSION_SECRET = "test-session-secret-that-is-at-least-32-characters";
    vi.clearAllMocks();
    mocks.profileFind.mockResolvedValue({ verificationState: "REJECTED", identityNumberHash: "hash" });
    mocks.recordFind.mockResolvedValue(null);
    mocks.profileUpdate.mockResolvedValue({});
    mocks.auditCreate.mockResolvedValue({});
  });

  it("moves an eligible landlord to UNVERIFIED and audits the explicit choice", async () => {
    const response = await POST(landlordRequest());
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ onboarding: { verificationState: "UNVERIFIED" }, duplicate: false });
    expect(mocks.profileUpdate).toHaveBeenCalledWith({ where: { userId: "landlord-1" }, data: { verificationState: "UNVERIFIED" } });
    expect(mocks.auditCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ action: "LANDLORD_IDENTITY_UPLOAD_DECLINED" }) });
  });

  it("is idempotent when the landlord already selected UNVERIFIED", async () => {
    mocks.profileFind.mockResolvedValue({ verificationState: "UNVERIFIED", identityNumberHash: "hash" });
    const response = await POST(landlordRequest());
    await expect(response.json()).resolves.toMatchObject({ onboarding: { verificationState: "UNVERIFIED" }, duplicate: true });
    expect(mocks.profileUpdate).not.toHaveBeenCalled();
  });
});
