import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const dbMock = vi.hoisted(() => ({
  listing: { findMany: vi.fn(), count: vi.fn() },
  property: { groupBy: vi.fn() },
  landlordProfile: { count: vi.fn() },
  tenantUnlock: { count: vi.fn() }
}));
vi.mock("@/lib/db", () => ({ db: dbMock }));

import { GET } from "@/app/api/listings/route";

describe("public listings route search contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.listing.findMany.mockResolvedValue([{
      id: "listing-1", title: "Nakuru home", verificationState: "APPROVED", expiresAt: null, publishedAt: new Date("2026-08-20T00:00:00Z"),
      unit: { unitType: "1 Bedroom", bathrooms: 1, sizeSquareMetres: 45, monthlyRentKes: 25000, property: { town: "Nakuru", approximateArea: "Section 58", approximateLatitude: -0.3, approximateLongitude: 36.1, owner: { landlordProfile: { verificationState: "APPROVED" } } } },
      media: []
    }]);
    dbMock.listing.count.mockResolvedValue(1);
    dbMock.property.groupBy.mockResolvedValue([{ town: "Nakuru" }, { town: "Nairobi" }, { town: "Nakuru" }]);
    dbMock.landlordProfile.count.mockResolvedValueOnce(2).mockResolvedValueOnce(1);
    dbMock.tenantUnlock.count.mockResolvedValue(0);
  });

  it("applies combined filters and returns distinct active towns", async () => {
    const response = await GET(new NextRequest("http://localhost:3001/api/listings?town=Nakuru&minRent=15000&maxRent=40000"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(dbMock.listing.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {
      status: "PUBLISHED", lifecycleStatus: "ACTIVE",
      unit: { property: { town: { equals: "Nakuru", mode: "insensitive" } }, monthlyRentKes: { gte: 15000, lte: 40000 } }
    } }));
    expect(body.towns).toEqual(["Nairobi", "Nakuru"]);
    expect(body.data[0].unit.property).not.toHaveProperty("owner");
  });
});
