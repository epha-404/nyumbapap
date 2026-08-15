import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Action, authorizationErrorResponse, authorizeRequest, requireResourceOwner, Resource } from "@/modules/auth/authorization";
import { verifyCsrfRequest } from "@/modules/auth/request-security";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Context) {
  if (!verifyCsrfRequest(request)) return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  const authorization = authorizeRequest(request, [{ resource: Resource.LISTING, action: Action.UPDATE }]);
  if (!authorization.ok) return authorization.response;
  const { id } = await params;
  const listing = await db.listing.findUnique({ where: { id }, select: { lifecycleStatus: true, unitId: true, unit: { select: { property: { select: { ownerId: true } } } } } });
  if (!listing) return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  try { requireResourceOwner(authorization.principal, Resource.LISTING, listing.unit.property.ownerId, Action.UPDATE); }
  catch (error) { return authorizationErrorResponse(error); }
  if (listing.lifecycleStatus === "UNLISTED") return NextResponse.json({ listing: { id, lifecycleStatus: "UNLISTED" }, duplicate: true });
  const now = new Date();
  await db.$transaction(async tx => {
    await tx.listing.update({ where: { id }, data: { lifecycleStatus: "UNLISTED", unlistedAt: now, pendingConfirmationSince: null } });
    await tx.rentalUnit.update({ where: { id: listing.unitId }, data: { availability: "OCCUPIED" } });
  });
  return NextResponse.json({ listing: { id, lifecycleStatus: "UNLISTED", unlistedAt: now }, duplicate: false });
}
