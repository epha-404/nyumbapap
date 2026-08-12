import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { clientIpHash } from "@/modules/auth/request-security";
import { sessionFromRequest } from "@/modules/auth/request-session";
import { Role } from "@/modules/auth/roles";
import { revealListingField } from "@/modules/listings/listing-data";
import { ensureAuditEventsImmutable } from "@/modules/verification/audit";

type Context = { params: Promise<{ id: string }> };

function auditData(request: Request, listingId: string, actorId: string | null, allowed: boolean, metadata: Prisma.InputJsonObject) {
  return {
    actorId,
    action: `LANDLORD_CONTACT_ACCESS_${allowed ? "GRANTED" : "DENIED"}`,
    entityType: "Listing",
    entityId: listingId,
    requestId: request.headers.get("x-request-id") ?? randomUUID(),
    ipHash: clientIpHash(request),
    metadata
  };
}

export async function GET(request: Request, { params }: Context) {
  const { id: listingId } = await params;
  const session = sessionFromRequest(request);
  await ensureAuditEventsImmutable();

  if (!session) {
    await db.auditEvent.create({ data: auditData(request, listingId, null, false, { reason: "UNAUTHENTICATED" }) });
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  if (session.role !== Role.CLIENT) {
    await db.auditEvent.create({ data: auditData(request, listingId, session.userId, false, { reason: "TENANT_REQUIRED" }) });
    return NextResponse.json({ error: "Tenant access required" }, { status: 403 });
  }

  const result = await db.$transaction(async (tx) => {
    const listing = await tx.listing.findUnique({
      where: { id: listingId },
      select: {
        unit: { select: { property: { select: { contactEncrypted: true, exactCoordinatesEncrypted: true, owner: { select: { landlordProfile: { select: { displayName: true } }, agentProfile: { select: { agencyName: true } } } } } } } },
        unlocks: {
          where: { tenantId: session.userId, payment: { state: "PAID" } },
          take: 1,
          select: { id: true, paymentId: true }
        }
      }
    });
    const unlock = listing?.unlocks[0];
    if (!listing || !unlock) {
      await tx.auditEvent.create({
        data: auditData(request, listingId, session.userId, false, { reason: listing ? "PAYMENT_UNLOCK_REQUIRED" : "LISTING_NOT_FOUND" })
      });
      return null;
    }
    await tx.auditEvent.create({
      data: auditData(request, listingId, session.userId, true, { unlockId: unlock.id, paymentId: unlock.paymentId })
    });
    return listing.unit.property;
  });

  if (!result) return NextResponse.json({ error: "A completed payment is required to access this contact" }, { status: 403 });
  const coordinates = JSON.parse(revealListingField(result.exactCoordinatesEncrypted)) as { latitude: number; longitude: number };
  return NextResponse.json({
    listingId,
    contact: revealListingField(result.contactEncrypted),
    contactName: result.owner.landlordProfile?.displayName ?? result.owner.agentProfile?.agencyName ?? "Property contact",
    exactCoordinates: coordinates
  });
}
