import type { PrismaClient } from "@prisma/client";
import type { Principal } from "@/modules/auth/authorization";
import { Action, requireResourceOwner, Resource } from "@/modules/auth/authorization";
import type { PrivateObjectStorage } from "@/modules/storage/provider";
import { ensureAuditEventsImmutable } from "@/modules/verification/audit";
import { processListingImage } from "./image-pipeline";

export async function saveListingImage(
  deps: { db: PrismaClient; storage: PrivateObjectStorage },
  input: {
    listingId: string;
    principal: Principal;
    bytes: Buffer;
    mimeType: string;
    sortOrder: number;
    requestId?: string | null;
    ipHash?: string | null;
  }
) {
  const listing = await deps.db.listing.findUnique({
    where: { id: input.listingId },
    select: { unit: { select: { property: { select: { ownerId: true } } } } }
  });
  if (!listing) throw new Error("LISTING_NOT_FOUND");
  requireResourceOwner(input.principal, Resource.LISTING, listing.unit.property.ownerId, Action.UPDATE);

  const processed = await processListingImage(input.bytes, input.mimeType);
  const uploaded: string[] = [];
  try {
    const primaryUpload = await deps.storage.put({
      key: processed.key,
      body: processed.body,
      contentType: processed.mimeType,
      cacheControl: "public, max-age=31536000, immutable"
    });
    uploaded.push(primaryUpload.key);
    const storedVariants: Array<(typeof processed.variants)[number] & { storedKey: string }> = [];
    for (const variant of processed.variants) {
      const stored = await deps.storage.put({
        key: variant.key,
        body: variant.body,
        contentType: variant.mimeType,
        cacheControl: "public, max-age=31536000, immutable"
      });
      uploaded.push(stored.key);
      storedVariants.push({ ...variant, storedKey: stored.key });
    }
    await ensureAuditEventsImmutable();
    return await deps.db.$transaction(async (tx) => {
      const media = await tx.listingMedia.create({
        data: {
          listingId: input.listingId,
          storageKey: primaryUpload.key,
          mimeType: processed.mimeType,
          width: processed.width,
          height: processed.height,
          sizeBytes: processed.sizeBytes,
          sortOrder: input.sortOrder,
          moderationState: "PENDING",
          variants: storedVariants.map((variant) => ({
            name: variant.name,
            key: variant.storedKey,
            mimeType: variant.mimeType,
            width: variant.width,
            height: variant.height,
            sizeBytes: variant.sizeBytes
          }))
        }
      });
      await tx.auditEvent.create({
        data: {
          actorId: input.principal.userId,
          action: "LISTING_PHOTO_SUBMITTED",
          entityType: "ListingMedia",
          entityId: media.id,
          requestId: input.requestId ?? null,
          ipHash: input.ipHash ?? null,
          metadata: { listingId: input.listingId, sortOrder: input.sortOrder }
        }
      });
      return media;
    });
  } catch (error) {
    await Promise.allSettled(uploaded.map((key) => deps.storage.delete(key)));
    throw error;
  }
}
