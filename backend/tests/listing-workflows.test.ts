import { beforeEach, describe, expect, it, vi } from "vitest";

const tx = vi.hoisted(() => ({
  listing: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn(), findMany: vi.fn() },
  enquiry: { create: vi.fn() },
  viewingRequest: { create: vi.fn() },
  report: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  rentalUnit: { update: vi.fn() },
  notificationOutbox: { create: vi.fn(), createMany: vi.fn() },
  auditEvent: { create: vi.fn() }
}));
const dbMock = vi.hoisted(() => ({ $transaction: vi.fn(), listing: { findUnique: vi.fn() } }));
const enforceWriteRateLimit = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/modules/rate-limit/write-rate-limit", () => ({ enforceWriteRateLimit }));
vi.mock("@/modules/verification/audit", () => ({ ensureAuditEventsImmutable: vi.fn() }));

import { POST as createEnquiry } from "@/app/api/listings/[id]/enquiries/route";
import { PATCH as moderateReport } from "@/app/api/moderation/reports/[id]/route";
import { POST as reconfirmListing } from "@/app/api/dashboard/listings/[id]/reconfirm/route";
import { POST as markListingRented } from "@/app/api/dashboard/listings/[id]/mark-rented/route";
import { createCsrfToken, CSRF_COOKIE } from "@/modules/auth/request-security";
import { createSessionToken, SESSION_COOKIE } from "@/modules/auth/session";
import { Role } from "@/modules/auth/roles";

function writeRequest(path: string, role: Role, userId: string, method: string, body?: unknown) {
  const csrf = createCsrfToken();
  const session = createSessionToken({ userId, role, displayName: "Test user" });
  return new Request(`http://localhost:3001/api/${path}`, {
    method,
    headers: { origin: "http://localhost:3001", cookie: `${SESSION_COOKIE}=${session}; ${CSRF_COOKIE}=${csrf}`, "x-csrf-token": csrf, "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined
  });
}

describe("listing interactions and lifecycle", () => {
  beforeEach(() => {
    process.env.SESSION_SECRET = "test-session-secret-that-is-at-least-32-characters";
    vi.clearAllMocks();
    enforceWriteRateLimit.mockResolvedValue(null);
    dbMock.$transaction.mockImplementation(async (callback) => callback(tx));
  });

  it("creates an enquiry and owner notification atomically", async () => {
    tx.listing.findFirst.mockResolvedValue({ unit: { property: { ownerId: "owner-1" } } });
    tx.enquiry.create.mockResolvedValue({ id: "enquiry-1", state: "OPEN", createdAt: new Date() });
    const response = await createEnquiry(writeRequest("listings/listing-1/enquiries", Role.CLIENT, "tenant-1", "POST", { message: "Is this home still available?" }), { params: Promise.resolve({ id: "listing-1" }) });
    expect(response.status).toBe(201);
    expect(tx.notificationOutbox.create).toHaveBeenCalledWith({ data: expect.objectContaining({ recipientId: "owner-1", topic: "NEW_ENQUIRY", dedupeKey: "enquiry:enquiry-1" }) });
    expect(enforceWriteRateLimit).toHaveBeenCalled();
  });

  it("pauses a reported listing and notifies both parties on takedown", async () => {
    tx.report.findUnique.mockResolvedValue({ id: "report-1", status: "OPEN", reporterId: "tenant-1", listingId: "listing-1", listing: { status: "PUBLISHED", unit: { property: { ownerId: "owner-1" } } } });
    const response = await moderateReport(writeRequest("moderation/reports/report-1", Role.VERIFIER, "verifier-1", "PATCH", { decision: "TAKEDOWN", notes: "Confirmed unavailable" }), { params: Promise.resolve({ id: "report-1" }) });
    expect(response.status).toBe(200);
    expect(tx.listing.update).toHaveBeenCalledWith({ where: { id: "listing-1" }, data: { status: "PAUSED" } });
    expect(tx.auditEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: "LISTING_REPORT_TAKEDOWN" }) });
    expect(tx.notificationOutbox.createMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.arrayContaining([expect.objectContaining({ recipientId: "tenant-1" }), expect.objectContaining({ recipientId: "owner-1" })]) }));
  });

  it("reconfirms only an owned, approved, available, expired listing", async () => {
    tx.listing.findUnique.mockResolvedValue({ status: "EXPIRED", verificationState: "APPROVED", unit: { availability: "AVAILABLE", property: { ownerId: "owner-1" } } });
    const response = await reconfirmListing(writeRequest("dashboard/listings/listing-1/reconfirm", Role.LANDLORD, "owner-1", "POST"), { params: Promise.resolve({ id: "listing-1" }) });
    expect(response.status).toBe(200);
    expect(tx.listing.update).toHaveBeenCalledWith({ where: { id: "listing-1" }, data: expect.objectContaining({ status: "PUBLISHED", expiresAt: expect.any(Date) }) });
    expect(tx.notificationOutbox.create).toHaveBeenCalledWith({ data: expect.objectContaining({ topic: "LISTING_RECONFIRMED" }) });
  });

  it("lets the owner directly unlist a rented unit without a grace period", async () => {
    dbMock.listing.findUnique.mockResolvedValue({ lifecycleStatus: "ACTIVE", unitId: "unit-1", unit: { property: { ownerId: "owner-1" } } });
    const response = await markListingRented(writeRequest("dashboard/listings/listing-1/mark-rented", Role.LANDLORD, "owner-1", "POST"), { params: Promise.resolve({ id: "listing-1" }) });
    expect(response.status).toBe(200);
    expect(tx.listing.update).toHaveBeenCalledWith({ where: { id: "listing-1" }, data: expect.objectContaining({ lifecycleStatus: "UNLISTED", pendingConfirmationSince: null }) });
    expect(tx.rentalUnit.update).toHaveBeenCalledWith({ where: { id: "unit-1" }, data: { availability: "OCCUPIED" } });
  });
});
