import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Action, authorizeRequest, Resource } from "@/modules/auth/authorization";
import { listingInputSchema, protectListingField } from "@/modules/listings/listing-data";
import { professionalOnboardingSubmitted } from "@/modules/onboarding/professional";
import { verifyCsrfRequest } from "@/modules/auth/request-security";
import { deriveCoarseLocation } from "@/modules/listings/location";

const IDEMPOTENCY_KEY = /^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$/;

function uniqueConflict(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "P2002");
}

export async function POST(request: Request) {
  if (!verifyCsrfRequest(request)) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }
  const authorization = authorizeRequest(request, [{ resource: Resource.LISTING, action: Action.CREATE }]);
  if (!authorization.ok) return authorization.response;
  if (!(await professionalOnboardingSubmitted(authorization.principal))) {
    return NextResponse.json({ error: "Complete your professional onboarding before creating a listing." }, { status: 409 });
  }
  const idempotencyKey = request.headers.get("idempotency-key")?.trim() ?? "";
  if (!IDEMPOTENCY_KEY.test(idempotencyKey)) {
    return NextResponse.json({ error: "A valid Idempotency-Key header is required" }, { status: 400 });
  }
  const ownerId = authorization.principal.userId;
  const existing = await db.listing.findFirst({ where: { creationOwnerId: ownerId, idempotencyKey }, select: { id: true } });
  if (existing) return NextResponse.json({ ok: true, id: existing.id, duplicate: true }, { status: 200 });

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
  let listing: { id: string };
  try {
    listing = await db.$transaction(async (tx) => {
    const created = await tx.listing.create({
      data: {
      title: d.title,
      description: d.description,
      creationOwnerId: ownerId,
      idempotencyKey,
      status: "PENDING_REVIEW",
      verificationState: "PENDING",
      unit: {
        create: {
          unitType: d.unitType,
          bedrooms: d.bedrooms,
          bathrooms: d.bathrooms,
          sizeSquareMetres: d.size,
          monthlyRentKes: d.rent,
          depositKes: d.deposit,
          amenities: ["Water", "Security"],
          availability: "AVAILABLE",
          property: {
            create: {
              ownerId,
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
      },
      include: { unit: { select: { propertyId: true } } }
    });
    return created;
    });
  } catch (error) {
    if (!uniqueConflict(error)) throw error;
    const duplicate = await db.listing.findFirst({ where: { creationOwnerId: ownerId, idempotencyKey }, select: { id: true } });
    if (!duplicate) throw error;
    return NextResponse.json({ ok: true, id: duplicate.id, duplicate: true }, { status: 200 });
  }
  return NextResponse.json({ ok: true, id: listing.id }, { status: 201 });
}
