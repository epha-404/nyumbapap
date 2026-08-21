import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { Action, authorizeRequest, Resource } from "@/modules/auth/authorization";
import { clientIpHash, verifyCsrfRequest } from "@/modules/auth/request-security";
import { ensureAuditEventsImmutable } from "@/modules/verification/audit";
import { protectVerificationNotes } from "@/modules/verification/documents";
import { verificationExpiresAt, VerificationKind } from "@/modules/verification/policy";
import { listingImageStorage } from "@/modules/storage/listing-image-storage";

type Context = { params: Promise<{ id: string }> };
const decisionSchema = z.object({ decision: z.enum(["APPROVE", "REJECT"]), notes: z.string().trim().max(1000).optional().default("") });

export async function PATCH(request: Request, { params }: Context) {
  if (!verifyCsrfRequest(request)) return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  const authorization = authorizeRequest(request, [{ resource: Resource.LISTING, action: Action.MODERATE }]);
  if (!authorization.ok) return authorization.response;
  const parsed = decisionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid decision" }, { status: 400 });
  const { id } = await params;
  const media = await db.listingMedia.findUnique({
    where: { id },
    select: { id: true, listingId: true, storageKey: true, moderationState: true, listing: { select: { unit: { select: { property: { select: { ownerId: true } } } } } } }
  });
  if (!media) return NextResponse.json({ error: "Photo not found" }, { status: 404 });
  if (media.moderationState !== "PENDING") return NextResponse.json({ error: "This photo has already been reviewed" }, { status: 409 });
  const approved = parsed.data.decision === "APPROVE";
  if (approved) {
    try {
      await listingImageStorage().get(media.storageKey);
    } catch (error) {
      console.error("Listing photo approval blocked because the stored image is unavailable", {
        mediaId: id,
        listingId: media.listingId,
        error: error instanceof Error ? error.message : "Unknown storage error"
      });
      return NextResponse.json({ error: "This photo file is unavailable. Ask the landlord to upload it again before approval." }, { status: 409 });
    }
  }
  const state = approved ? "APPROVED" : "REJECTED";
  const reviewedAt = new Date();
  const photoExpiresAt = approved ? verificationExpiresAt(VerificationKind.LISTING_PHOTO, reviewedAt) : null;
  const notesEncrypted = parsed.data.notes ? protectVerificationNotes(parsed.data.notes) : null;
  await ensureAuditEventsImmutable();
  try {
    const result = await db.$transaction(async (tx) => {
      const claimed = await tx.listingMedia.updateMany({ where: { id, moderationState: "PENDING" }, data: { moderationState: state } });
      if (claimed.count !== 1) throw new Error("DECISION_CONFLICT");
      const verification = await tx.verificationRecord.create({
        data: {
          subjectUserId: media.listing.unit.property.ownerId,
          reviewerId: authorization.principal.userId,
          kind: VerificationKind.LISTING_PHOTO,
          state,
          notesEncrypted,
          expiresAt: photoExpiresAt,
          reviewedAt
        }
      });
      const [pendingCount, approvedCount] = await Promise.all([
        tx.listingMedia.count({ where: { listingId: media.listingId, moderationState: "PENDING" } }),
        tx.listingMedia.count({ where: { listingId: media.listingId, moderationState: "APPROVED" } })
      ]);
      let listingState: "PENDING" | "APPROVED" | "REJECTED" = "PENDING";
      if (pendingCount === 0 && approvedCount > 0) {
        listingState = "APPROVED";
        await tx.listing.update({
          where: { id: media.listingId },
          data: { verificationState: "APPROVED", status: "PUBLISHED", lifecycleStatus: "ACTIVE", lastConfirmedAt: reviewedAt, pendingConfirmationSince: null, unlistedAt: null, publishedAt: reviewedAt, expiresAt: verificationExpiresAt(VerificationKind.LISTING, reviewedAt) }
        });
      } else if (pendingCount === 0) {
        listingState = "REJECTED";
        await tx.listing.update({ where: { id: media.listingId }, data: { verificationState: "REJECTED", status: "REJECTED", expiresAt: null } });
      } else {
        await tx.listing.update({ where: { id: media.listingId }, data: { verificationState: "PENDING", status: "PENDING_REVIEW" } });
      }
      await tx.auditEvent.create({
        data: {
          actorId: authorization.principal.userId,
          action: `LISTING_PHOTO_${approved ? "APPROVED" : "REJECTED"}`,
          entityType: "ListingMedia",
          entityId: id,
          requestId: request.headers.get("x-request-id"),
          ipHash: clientIpHash(request),
          metadata: { listingId: media.listingId, verificationRecordId: verification.id, decision: parsed.data.decision, expiresAt: photoExpiresAt?.toISOString() ?? null }
        }
      });
      return { listingState };
    });
    return NextResponse.json({ id, moderationState: state, listingState: result.listingState });
  } catch (error) {
    if (error instanceof Error && error.message === "DECISION_CONFLICT") {
      return NextResponse.json({ error: "This photo was reviewed by another verifier" }, { status: 409 });
    }
    throw error;
  }
}
