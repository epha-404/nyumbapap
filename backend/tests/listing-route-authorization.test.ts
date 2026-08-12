import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  listing: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn()
  },
  enquiry: { count: vi.fn() },
  viewingRequest: { count: vi.fn() },
  payment: { aggregate: vi.fn() },
  listingDailyView: { count: vi.fn() },
  tenantUnlock: { count: vi.fn() }
}));

vi.mock("@/lib/db", () => ({ db: dbMock }));

import { PUT as updateListing } from "@/app/api/dashboard/listings/[id]/route";
import { GET as landlordDashboard } from "@/app/api/dashboard/landlord/route";
import { createCsrfToken, CSRF_COOKIE } from "@/modules/auth/request-security";
import { createSessionToken, SESSION_COOKIE } from "@/modules/auth/session";
import { Role } from "@/modules/auth/roles";

function requestFor(role: Role, userId: string, method = "GET", body?: unknown) {
  const csrf = createCsrfToken();
  const session = createSessionToken({ userId, role, displayName: "Test user" });
  return new Request("http://localhost:3001/api/dashboard/listings/listing-1", {
    method,
    headers: {
      origin: "http://localhost:3001",
      cookie: `${SESSION_COOKIE}=${session}; ${CSRF_COOKIE}=${csrf}`,
      "x-csrf-token": csrf,
      "content-type": "application/json"
    },
    body: body ? JSON.stringify(body) : undefined
  });
}

describe("listing route object authorization", () => {
  beforeEach(() => {
    process.env.SESSION_SECRET = "test-session-secret-that-is-at-least-32-characters";
    vi.clearAllMocks();
  });

  it("does not let a landlord edit another landlord's listing", async () => {
    dbMock.listing.findUnique.mockResolvedValue({
      unit: { property: { ownerId: "landlord-2" } }
    });
    const response = await updateListing(
      requestFor(Role.LANDLORD, "landlord-1", "PUT", {
        title: "A valid listing title",
        description: "A sufficiently detailed property description for testing.",
        county: "Nairobi",
        town: "Nairobi",
        area: "Kilimani",
        address: "Private address",
        contact: "0712345678",
        unitType: "1 Bedroom",
        bedrooms: 1,
        bathrooms: 1,
        size: 45,
        rent: 25000,
        deposit: 25000
      }),
      { params: Promise.resolve({ id: "listing-1" }) }
    );
    expect(response.status).toBe(403);
    expect(dbMock.listing.update).not.toHaveBeenCalled();
  });

  it("does not query or return landlord financial data for an agent", async () => {
    dbMock.listing.findMany.mockResolvedValue([]);
    dbMock.enquiry.count.mockResolvedValue(0);
    dbMock.viewingRequest.count.mockResolvedValue(0);
    dbMock.listingDailyView.count.mockResolvedValue(12);
    dbMock.tenantUnlock.count.mockResolvedValue(3);
    const response = await landlordDashboard(requestFor(Role.AGENT, "agent-1"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.canViewFinancials).toBe(false);
    expect(body.stats.revenue).toBeNull();
    expect(body.stats).toMatchObject({ views: 12, unlocks: 3, acceptedViewings: 0 });
    expect(dbMock.viewingRequest.count).toHaveBeenCalledWith({ where: expect.objectContaining({ status: "ACCEPTED" }) });
    expect(dbMock.payment.aggregate).not.toHaveBeenCalled();
  });
});
