import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listingFindFirst: vi.fn(),
  listingCreate: vi.fn(),
  transaction: vi.fn(),
  onboarding: vi.fn().mockResolvedValue(true)
}));

vi.mock("@/lib/db", () => ({ db: { listing: { findFirst: mocks.listingFindFirst }, $transaction: mocks.transaction } }));
vi.mock("@/modules/auth/request-security", () => ({ verifyCsrfRequest: () => true }));
vi.mock("@/modules/auth/authorization", () => ({
  Action: { CREATE: "CREATE" }, Resource: { LISTING: "LISTING" },
  authorizeRequest: () => ({ ok: true, principal: { userId: "owner-1", role: "LANDLORD", displayName: "Owner" } })
}));
vi.mock("@/modules/onboarding/professional", () => ({ professionalOnboardingSubmitted: mocks.onboarding }));
vi.mock("@/modules/listings/location", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/modules/listings/location")>()), deriveCoarseLocation: () => Promise.resolve({ town: "Nairobi", area: "Kilimani", latitude: -1.29, longitude: 36.78 }) }));
vi.mock("@/modules/listings/listing-data", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/modules/listings/listing-data")>()), protectListingField: (value: string) => Buffer.from(value) }));

import { POST } from "@/app/api/dashboard/listings/route";

const validBody = { title: "Bright apartment", description: "A bright apartment close to public transport.", county: "Nairobi", town: "Nairobi", area: "Kilimani", contact: "0712345678", unitType: "1 Bedroom", bedrooms: 1, bathrooms: 1, size: 45, rent: 25000, deposit: 25000, latitude: -1.29, longitude: 36.78, locationConfirmed: true };
function request(key = "12345678-1234-4234-9234-123456789012") { return new Request("http://localhost/api/dashboard/listings", { method: "POST", headers: { "content-type": "application/json", "idempotency-key": key }, body: JSON.stringify(validBody) }); }

describe("listing creation idempotency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listingFindFirst.mockResolvedValue(null);
    mocks.listingCreate.mockResolvedValue({ id: "listing-1", unit: { propertyId: "property-1" } });
    mocks.transaction.mockImplementation(async (callback) => callback({ listing: { create: mocks.listingCreate } }));
  });

  it("requires a valid idempotency key", async () => {
    expect((await POST(request("short"))).status).toBe(400);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("returns the original listing for a repeated owner/key without creating another", async () => {
    mocks.listingFindFirst.mockResolvedValue({ id: "listing-existing" });
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ id: "listing-existing", duplicate: true });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("stores owner and key on first creation", async () => {
    const response = await POST(request());
    expect(response.status).toBe(201);
    expect(mocks.listingCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ creationOwnerId: "owner-1", idempotencyKey: "12345678-1234-4234-9234-123456789012" }) }));
  });

  it("returns the winner when concurrent requests race on the unique index", async () => {
    mocks.transaction.mockRejectedValueOnce(Object.assign(new Error("duplicate"), { code: "P2002" }));
    mocks.listingFindFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "listing-winner" });
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ id: "listing-winner", duplicate: true });
  });
});
