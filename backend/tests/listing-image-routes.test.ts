import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  db: {
    listing: { findUnique: vi.fn(), findFirst: vi.fn() },
    listingMedia: { count: vi.fn() },
    unlockFeeConfig: { findUnique: vi.fn() },
    tenantUnlock: { findUnique: vi.fn() },
    listingDailyView: { upsert: vi.fn() }
  },
  saveListingImage: vi.fn(),
  storage: {}
}));

vi.mock("@/lib/db", () => ({ db: mocks.db }));
vi.mock("@/modules/media/save-listing-image", () => ({ saveListingImage: mocks.saveListingImage }));
vi.mock("@/modules/storage/listing-image-storage", () => ({
  listingImageStorage: () => mocks.storage
}));

import { POST as uploadImages } from "@/app/api/dashboard/listings/[id]/images/route";
import { GET as publicListing } from "@/app/api/listings/[id]/route";
import { createCsrfToken, CSRF_COOKIE } from "@/modules/auth/request-security";
import { createSessionToken, SESSION_COOKIE } from "@/modules/auth/session";
import { Role } from "@/modules/auth/roles";

function uploadRequest(role: Role, userId: string, images = 1) {
  const csrf = createCsrfToken();
  const session = createSessionToken({ userId, role, displayName: "Test user" });
  const form = new FormData();
  for (let index = 0; index < images; index++) {
    form.append("images", new Blob(["image"], { type: "image/jpeg" }), `room-${index}.jpg`);
  }
  return new Request("http://localhost:3001/api/dashboard/listings/listing-1/images", {
    method: "POST",
    headers: {
      origin: "http://localhost:3001",
      cookie: `${SESSION_COOKIE}=${session}; ${CSRF_COOKIE}=${csrf}`,
      "x-csrf-token": csrf
    },
    body: form
  });
}

describe("listing image routes", () => {
  beforeEach(() => {
    process.env.SESSION_SECRET = "test-session-secret-that-is-at-least-32-characters";
    vi.clearAllMocks();
    mocks.db.unlockFeeConfig.findUnique.mockResolvedValue({ rate: 0.025, floorKes: 100, ceilingKes: 800 });
  });

  it("rejects an agent uploading to another owner's listing", async () => {
    mocks.db.listing.findUnique.mockResolvedValue({
      unit: { property: { ownerId: "landlord-1" } }
    });
    const response = await uploadImages(
      uploadRequest(Role.AGENT, "agent-1"),
      { params: Promise.resolve({ id: "listing-1" }) }
    );
    expect(response.status).toBe(403);
    expect(mocks.saveListingImage).not.toHaveBeenCalled();
  });

  it("passes every owner upload through the existing saveListingImage path", async () => {
    mocks.db.listing.findUnique.mockResolvedValue({
      unit: { property: { ownerId: "landlord-1" } }
    });
    mocks.db.listingMedia.count.mockResolvedValue(0);
    mocks.saveListingImage
      .mockResolvedValueOnce({ id: "media-1", width: 1200, height: 800 })
      .mockResolvedValueOnce({ id: "media-2", width: 1200, height: 800 });
    const response = await uploadImages(
      uploadRequest(Role.LANDLORD, "landlord-1", 2),
      { params: Promise.resolve({ id: "listing-1" }) }
    );
    expect(response.status).toBe(201);
    expect(mocks.saveListingImage).toHaveBeenCalledTimes(2);
    expect((await response.json()).images).toHaveLength(2);
  });

  it("returns all approved images from public detail without authentication", async () => {
    mocks.db.listing.findFirst.mockResolvedValue({
      id: "listing-1",
      title: "Published home",
      description: "A public description",
      verificationState: "APPROVED",
      unit: {
        unitType: "2 Bedroom",
        bedrooms: 2,
        bathrooms: 1,
        sizeSquareMetres: 70,
        monthlyRentKes: 30000,
        depositKes: 30000,
        amenities: [],
        property: {
          county: "Nairobi",
          town: "Nairobi",
          approximateArea: "Kasarani",
          approximateLatitude: null,
          approximateLongitude: null,
          owner: { landlordProfile: { verificationState: "UNVERIFIED" } }
        }
      },
      media: [
        { id: "media-1", width: 1200, height: 800 },
        { id: "media-2", width: 800, height: 1200 }
      ]
    });
    const response = await publicListing(
      new Request("http://localhost:3001/api/listings/listing-1"),
      { params: Promise.resolve({ id: "listing-1" }) }
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.listing.images).toHaveLength(2);
    expect(body.listing.images[0].url).toBe("/api/listing-media/media-1");
    expect(body.listing.landlordBadge).toEqual({ state: "unverified", label: "Unverified landlord" });
    expect(body.listing.unit.property).not.toHaveProperty("owner");
    expect(body.listing.unit.property).not.toHaveProperty("exactAddressEncrypted");
    expect(mocks.db.listingDailyView.upsert).toHaveBeenCalledOnce();
  });
});
