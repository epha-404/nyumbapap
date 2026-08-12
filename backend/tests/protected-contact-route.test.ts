import { beforeEach, describe, expect, it, vi } from "vitest";

const auditCreate = vi.fn();
const listingFindUnique = vi.fn();
const dbMock = vi.hoisted(() => ({
  auditEvent: { create: vi.fn() },
  $transaction: vi.fn()
}));

vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/modules/verification/audit", () => ({ ensureAuditEventsImmutable: vi.fn() }));

import { GET } from "@/app/api/listings/[id]/contact/route";
import { encryptField } from "@/lib/crypto";
import { createSessionToken, SESSION_COOKIE } from "@/modules/auth/session";
import { Role } from "@/modules/auth/roles";

function request(role?: Role, userId = "tenant-1") {
  const cookie = role ? `${SESSION_COOKIE}=${createSessionToken({ userId, role, displayName: "Test user" })}` : undefined;
  return new Request("http://localhost:3001/api/listings/listing-1/contact", {
    headers: { ...(cookie ? { cookie } : {}), "x-forwarded-for": "192.0.2.10", "x-request-id": "request-1" }
  });
}

const context = { params: Promise.resolve({ id: "listing-1" }) };

describe("protected landlord contact", () => {
  beforeEach(() => {
    process.env.SESSION_SECRET = "test-session-secret-that-is-at-least-32-characters";
    process.env.FIELD_ENCRYPTION_KEY_BASE64 = Buffer.alloc(32, 7).toString("base64");
    vi.clearAllMocks();
    dbMock.auditEvent.create = auditCreate;
    dbMock.$transaction.mockImplementation(async (callback) => callback({ listing: { findUnique: listingFindUnique }, auditEvent: { create: auditCreate } }));
  });

  it("returns contact only to the tenant with a paid unlock and audits the grant", async () => {
    listingFindUnique.mockResolvedValue({
      unit: { property: { contactEncrypted: encryptField("+254700123456", process.env.FIELD_ENCRYPTION_KEY_BASE64!), exactCoordinatesEncrypted: encryptField(JSON.stringify({ latitude: -1.2, longitude: 36.8 }), process.env.FIELD_ENCRYPTION_KEY_BASE64!), owner: { landlordProfile: { displayName: "Jane Owner" }, agentProfile: null } } },
      unlocks: [{ id: "unlock-1", paymentId: "payment-1" }]
    });
    const response = await GET(request(Role.CLIENT), context);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ listingId: "listing-1", contact: "+254700123456", contactName: "Jane Owner", exactCoordinates: { latitude: -1.2, longitude: 36.8 } });
    expect(auditCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ actorId: "tenant-1", action: "LANDLORD_CONTACT_ACCESS_GRANTED", metadata: { unlockId: "unlock-1", paymentId: "payment-1" } }) });
  });

  it("denies and audits a tenant without a paid unlock", async () => {
    listingFindUnique.mockResolvedValue({ unit: { property: { contactEncrypted: Buffer.from("hidden") } }, unlocks: [] });
    const response = await GET(request(Role.CLIENT), context);
    expect(response.status).toBe(403);
    expect(auditCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ action: "LANDLORD_CONTACT_ACCESS_DENIED", metadata: { reason: "PAYMENT_UNLOCK_REQUIRED" } }) });
  });

  it("audits unauthenticated and non-tenant attempts without querying contact data", async () => {
    const anonymous = await GET(request(), context);
    expect(anonymous.status).toBe(401);
    expect(auditCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ actorId: null, metadata: { reason: "UNAUTHENTICATED" } }) });
    const landlord = await GET(request(Role.LANDLORD, "landlord-1"), context);
    expect(landlord.status).toBe(403);
    expect(auditCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ actorId: "landlord-1", metadata: { reason: "TENANT_REQUIRED" } }) });
    expect(dbMock.$transaction).not.toHaveBeenCalled();
  });
});
