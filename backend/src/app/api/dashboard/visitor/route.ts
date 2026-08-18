import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Action, authorizeRequest, Resource } from "@/modules/auth/authorization";
import { landlordVerificationBadge } from "@/modules/listings/ranking";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authorization = authorizeRequest(request, [{ resource: Resource.CLIENT_ACTIVITY, action: Action.READ }]);
  if (!authorization.ok) return authorization.response;
  const session = authorization.principal;

  const [listings, unlocks, enquiries, viewings] = await Promise.all([
    db.listing.findMany({ where: { status: "PUBLISHED", lifecycleStatus: "ACTIVE" }, include: { unit: { include: { property: { include: { owner: { select: { landlordProfile: { select: { verificationState: true } } } } } } } }, media: { where: { moderationState: "APPROVED" }, orderBy: { sortOrder: "asc" }, select: { id: true } } }, orderBy: { publishedAt: "desc" }, take: 30 }),
    db.tenantUnlock.count({ where: { tenantId: session.userId } }),
    db.enquiry.count({ where: { tenantId: session.userId } }),
    db.viewingRequest.count({ where: { tenantId: session.userId } })
  ]);

  return NextResponse.json({
    displayName: session.displayName,
    stats: { listings: listings.length, unlocks, enquiries, viewings },
    listings: listings.map((listing) => ({
      id: listing.id,
      title: listing.title,
      area: listing.unit.property.approximateArea,
      town: listing.unit.property.town,
      unitType: listing.unit.unitType,
      bathrooms: listing.unit.bathrooms,
      sizeSquareMetres: listing.unit.sizeSquareMetres,
      monthlyRentKes: listing.unit.monthlyRentKes,
      imageUrl: listing.media[0] ? `/api/listing-media/${listing.media[0].id}` : null,
      landlordBadge: landlordVerificationBadge(listing.unit.property.owner.landlordProfile?.verificationState ?? null)
    }))
  });
}
