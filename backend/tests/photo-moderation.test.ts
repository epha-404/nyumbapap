import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const tx = {
    listingMedia: { updateMany: vi.fn(), count: vi.fn() },
    verificationRecord: { create: vi.fn() },
    listing: { update: vi.fn() },
    auditEvent: { create: vi.fn() }
  };
  return {
    tx,
    db: {
      listingMedia: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn() },
      verificationRecord: { findMany: vi.fn() },
      listing: { findMany: vi.fn() },
      $transaction: vi.fn(async (callback: (transaction: typeof tx) => unknown) => callback(tx))
    },
    storage: { get: vi.fn() }
  };
});

vi.mock("@/lib/db", () => ({ db: mocks.db }));
vi.mock("@/modules/auth/authorization", () => ({
  Action: { MODERATE: "MODERATE", READ: "READ", READ_ANY: "READ_ANY" },
  Resource: { LISTING: "LISTING", IDENTITY: "IDENTITY" },
  authorizeRequest: () => ({ ok: true, principal: { userId: "admin-1", role: "ADMIN", displayName: "Admin" } })
}));
vi.mock("@/modules/auth/request-security", () => ({ verifyCsrfRequest: () => true, clientIpHash: () => "ip-hash" }));
vi.mock("@/modules/verification/audit", () => ({ ensureAuditEventsImmutable: vi.fn() }));
vi.mock("@/modules/verification/documents", () => ({ protectVerificationNotes: (value: string) => Buffer.from(value) }));
vi.mock("@/modules/storage/listing-image-storage", () => ({ listingImageStorage: () => mocks.storage }));

import { PATCH } from "@/app/api/moderation/photos/[id]/route";
import { GET as moderationQueue } from "@/app/api/moderation/queue/route";
import { GET as publicMedia } from "@/app/api/listing-media/[id]/route";

const context = { params: Promise.resolve({ id: "photo-1" }) };

describe("listing photo approval", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.db.listingMedia.findUnique.mockResolvedValue({
      id: "photo-1", listingId: "listing-1", storageKey: "stored-image", moderationState: "PENDING",
      listing: { unit: { property: { ownerId: "landlord-1" } } }
    });
    mocks.storage.get.mockResolvedValue({ body: new Uint8Array([1, 2, 3]), contentType: "image/webp", cacheControl: "public, max-age=31536000" });
    mocks.tx.listingMedia.updateMany.mockResolvedValue({ count: 1 });
    mocks.tx.verificationRecord.create.mockResolvedValue({ id: "verification-1" });
    mocks.tx.listingMedia.count.mockResolvedValueOnce(0).mockResolvedValueOnce(1);
    mocks.db.verificationRecord.findMany.mockResolvedValue([]);
    mocks.db.listingMedia.findMany.mockResolvedValue([]);
    mocks.db.listing.findMany.mockResolvedValue([]);
  });

  it("approves the photo, publishes the listing, removes it from pending, and serves the image publicly", async () => {
    const response = await PATCH(new Request("http://localhost:3001/api/moderation/photos/photo-1", {
      method: "PATCH", body: JSON.stringify({ decision: "APPROVE", notes: "Interior is clear" })
    }), context);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ moderationState: "APPROVED", listingState: "APPROVED" });
    expect(mocks.tx.listingMedia.updateMany).toHaveBeenCalledWith({
      where: { id: "photo-1", moderationState: "PENDING" },
      data: { moderationState: "APPROVED" }
    });
    expect(mocks.tx.listing.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "listing-1" },
      data: expect.objectContaining({ verificationState: "APPROVED", status: "PUBLISHED", lifecycleStatus: "ACTIVE" })
    }));

    const queueResponse = await moderationQueue(new Request("http://localhost:3001/api/moderation/queue"));
    expect(queueResponse.status).toBe(200);
    await expect(queueResponse.json()).resolves.toMatchObject({ photos: [], listings: [] });
    expect(mocks.db.listingMedia.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { moderationState: "PENDING" } }));

    mocks.db.listingMedia.findFirst.mockResolvedValue({ storageKey: "stored-image", mimeType: "image/webp", variants: [] });
    const imageResponse = await publicMedia(new Request("http://localhost:3001/api/listing-media/photo-1"), context);
    expect(imageResponse.status).toBe(200);
    expect(await imageResponse.arrayBuffer()).toEqual(new Uint8Array([1, 2, 3]).buffer);
  });

  it("does not approve a database row whose backing image is missing", async () => {
    mocks.storage.get.mockRejectedValue(new Error("NISOKO_STORAGE_DOWNLOAD_FAILED:404"));
    const response = await PATCH(new Request("http://localhost:3001/api/moderation/photos/photo-1", {
      method: "PATCH", body: JSON.stringify({ decision: "APPROVE" })
    }), context);
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ error: expect.stringContaining("upload it again") });
    expect(mocks.db.$transaction).not.toHaveBeenCalled();
  });
});
