import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Action, authorizeRequest, Resource } from "@/modules/auth/authorization";
import { ensureAuditEventsImmutable } from "@/modules/verification/audit";
import { BADGE_DEFINITIONS } from "@/modules/verification/policy";

export async function GET(request: Request) {
  const authorization = authorizeRequest(request, [
    { resource: Resource.IDENTITY, action: Action.READ },
    { resource: Resource.LISTING, action: Action.READ_ANY }
  ]);
  if (!authorization.ok) return authorization.response;
  await ensureAuditEventsImmutable();
  const [identities, photos, listings] = await Promise.all([
    db.verificationRecord.findMany({
      where: { state: "PENDING", documentStorageKeyEncrypted: { not: null } },
      orderBy: { createdAt: "asc" },
      select: {
        id: true, kind: true, createdAt: true,
        subject: { select: { id: true, role: true, landlordProfile: { select: { displayName: true } }, agentProfile: { select: { agencyName: true } } } }
      }
    }),
    db.listingMedia.findMany({
      where: { moderationState: "PENDING" },
      orderBy: { createdAt: "asc" },
      select: { id: true, listingId: true, width: true, height: true, createdAt: true, listing: { select: { title: true } } }
    }),
    db.listing.findMany({
      where: { status: "PENDING_REVIEW" },
      orderBy: { createdAt: "asc" },
      select: { id: true, title: true, createdAt: true, unit: { select: { unitType: true, monthlyRentKes: true, property: { select: { town: true, approximateArea: true } } } } }
    })
  ]);
  return NextResponse.json({
    badgeDefinitions: BADGE_DEFINITIONS,
    listings: listings.map((item) => ({
      id: item.id, title: item.title, submittedAt: item.createdAt,
      unitType: item.unit.unitType, monthlyRentKes: item.unit.monthlyRentKes,
      town: item.unit.property.town, area: item.unit.property.approximateArea
    })),
    identities: identities.map((item) => ({
      id: item.id,
      kind: item.kind,
      role: item.subject.role,
      subjectName: item.subject.landlordProfile?.displayName ?? item.subject.agentProfile?.agencyName ?? "Professional account",
      submittedAt: item.createdAt,
      documentUrl: `/api/moderation/identities/${item.id}/document`
    })),
    photos: photos.map((item) => ({
      id: item.id, listingId: item.listingId, listingTitle: item.listing.title,
      width: item.width, height: item.height, submittedAt: item.createdAt,
      contentUrl: `/api/moderation/photos/${item.id}/content`
    }))
  });
}
