import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  Action,
  authorizationErrorResponse,
  authorizeRequest,
  requireResourceOwner,
  Resource
} from "@/modules/auth/authorization";
import { verifyCsrfRequest } from "@/modules/auth/request-security";
import { listingInputSchema, protectListingField, revealListingField } from "@/modules/listings/listing-data";
import { deriveCoarseLocation } from "@/modules/listings/location";

type Context = { params: Promise<{ id: string }> };

const listingInclude = {
  unit: { include: { property: true } }
} as const;

function authorizeListingOwner(
  principal: Parameters<typeof requireResourceOwner>[0],
  ownerId: string,
  action: Action
) {
  try {
    requireResourceOwner(principal, Resource.LISTING, ownerId, action);
    return null;
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}

export async function GET(request: Request, { params }: Context) {
  const authorization = authorizeRequest(request, [{ resource: Resource.LISTING, action: Action.READ }]);
  if (!authorization.ok) return authorization.response;
  const { id } = await params;
  const listing = await db.listing.findUnique({ where: { id }, include: listingInclude });
  if (!listing) return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  const denied = authorizeListingOwner(authorization.principal, listing.unit.property.ownerId, Action.READ);
  if (denied) return denied;

  let coordinates: { latitude?: number; longitude?: number } = {};
  try {
    coordinates = JSON.parse(revealListingField(listing.unit.property.exactCoordinatesEncrypted));
  } catch {}

  return NextResponse.json({
    listing: {
      id: listing.id,
      title: listing.title,
      description: listing.description,
      status: listing.status,
      verificationState: listing.verificationState,
      lifecycleStatus: listing.lifecycleStatus,
      county: listing.unit.property.county,
      town: listing.unit.property.town,
      area: listing.unit.property.approximateArea,
      address: revealListingField(listing.unit.property.exactAddressEncrypted),
      contact: revealListingField(listing.unit.property.contactEncrypted),
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      locationConfirmed: Boolean(coordinates.latitude && coordinates.longitude),
      unitType: listing.unit.unitType,
      bedrooms: listing.unit.bedrooms,
      bathrooms: listing.unit.bathrooms,
      size: listing.unit.sizeSquareMetres ?? 10,
      rent: listing.unit.monthlyRentKes,
      deposit: listing.unit.depositKes ?? 0
    }
  });
}

export async function PUT(request: Request, { params }: Context) {
  if (!verifyCsrfRequest(request)) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }
  const authorization = authorizeRequest(request, [{ resource: Resource.LISTING, action: Action.UPDATE }]);
  if (!authorization.ok) return authorization.response;
  const { id } = await params;
  const existing = await db.listing.findUnique({
    where: { id },
    select: { unit: { select: { propertyId: true, property: { select: { ownerId: true } } } } }
  });
  if (!existing) return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  const denied = authorizeListingOwner(authorization.principal, existing.unit.property.ownerId, Action.UPDATE);
  if (denied) return denied;

  const parsed = listingInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid listing" }, { status: 400 });
  }
  const d = parsed.data;
  let coarse;
  try {
    coarse = await deriveCoarseLocation({ latitude: d.latitude, longitude: d.longitude });
  } catch {
    return NextResponse.json({ error: "Could not resolve this confirmed location. Please try again." }, { status: 502 });
  }
  await db.$transaction(async (tx) => {
    await tx.listing.update({
      where: { id },
      data: {
      title: d.title,
      description: d.description,
      status: "PENDING_REVIEW",
      verificationState: "PENDING",
      publishedAt: null,
      unit: {
        update: {
          unitType: d.unitType,
          bedrooms: d.bedrooms,
          bathrooms: d.bathrooms,
          sizeSquareMetres: d.size,
          monthlyRentKes: d.rent,
          depositKes: d.deposit,
          property: {
            update: {
              county: d.county,
              town: coarse.town,
              approximateArea: coarse.area,
              approximateLatitude: coarse.latitude,
              approximateLongitude: coarse.longitude,
              searchPoint: { type: "Point", coordinates: [coarse.longitude, coarse.latitude] },
              exactAddressEncrypted: protectListingField(d.address),
              exactCoordinatesEncrypted: protectListingField(JSON.stringify({ latitude: d.latitude, longitude: d.longitude })),
              contactEncrypted: protectListingField(d.contact)
            }
          }
        }
      }
      }
    });
  });
  return NextResponse.json({ ok: true, id });
}

export async function DELETE(request: Request, { params }: Context) {
  if (!verifyCsrfRequest(request)) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }
  const authorization = authorizeRequest(request, [{ resource: Resource.LISTING, action: Action.DELETE }]);
  if (!authorization.ok) return authorization.response;
  const { id } = await params;
  const existing = await db.listing.findUnique({
    where: { id },
    select: { unitId: true, unit: { select: { propertyId: true, property: { select: { ownerId: true } } } } }
  });
  if (!existing) return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  const denied = authorizeListingOwner(authorization.principal, existing.unit.property.ownerId, Action.DELETE);
  if (denied) return denied;

  await db.$transaction(async (tx) => {
    await tx.listing.delete({ where: { id } });
    const remainingListings = await tx.listing.count({ where: { unitId: existing.unitId } });
    if (remainingListings === 0) await tx.rentalUnit.delete({ where: { id: existing.unitId } });
    const remainingUnits = await tx.rentalUnit.count({ where: { propertyId: existing.unit.propertyId } });
    if (remainingUnits === 0) await tx.property.delete({ where: { id: existing.unit.propertyId } });
  });
  return NextResponse.json({ ok: true });
}
