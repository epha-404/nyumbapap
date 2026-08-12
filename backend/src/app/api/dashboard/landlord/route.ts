import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Action, authorizeRequest, Resource } from "@/modules/auth/authorization";
import { can } from "@/modules/auth/roles";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authorization = authorizeRequest(request, [{ resource: Resource.LISTING, action: Action.READ }]);
  if (!authorization.ok) return authorization.response;
  const session = authorization.principal;
  const canViewFinancials = can(session.role, Resource.LANDLORD_FINANCE, Action.READ);

  const [listings, enquiries, views, unlocks, acceptedViewings] = await Promise.all([
    db.listing.findMany({ where: { unit: { property: { ownerId: session.userId } } }, include: { unit: { include: { property: true } } }, orderBy: { createdAt: "desc" } }),
    db.enquiry.count({ where: { listing: { unit: { property: { ownerId: session.userId } } } } }),
    db.listingDailyView.count({ where: { listing: { unit: { property: { ownerId: session.userId } } } } }),
    db.tenantUnlock.count({ where: { payment: { state: "PAID" }, listing: { unit: { property: { ownerId: session.userId } } } } }),
    db.viewingRequest.count({ where: { status: "ACCEPTED", listing: { unit: { property: { ownerId: session.userId } } } } })
  ]);
  const revenue = canViewFinancials
    ? await db.payment.aggregate({ where: { state: "PAID", listing: { unit: { property: { ownerId: session.userId } } } }, _sum: { amountKes: true } })
    : null;

  return NextResponse.json({
    displayName: session.displayName,
    role: session.role,
    canViewFinancials,
    stats: {
      listings: listings.length,
      activeListings: listings.filter((listing) => listing.status === "PUBLISHED").length,
      enquiries,
      views,
      unlocks,
      acceptedViewings,
      revenue: revenue?._sum.amountKes ?? null
    },
    listings: listings.map((listing) => ({
      id: listing.id,
      title: listing.title,
      status: listing.status,
      area: listing.unit.property.approximateArea,
      town: listing.unit.property.town,
      monthlyRentKes: listing.unit.monthlyRentKes
    }))
  });
}
