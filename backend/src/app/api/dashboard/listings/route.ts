import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Action, authorizeRequest, Resource } from "@/modules/auth/authorization";
import { listingInputSchema, protectListingField } from "@/modules/listings/listing-data";
import { professionalOnboardingSubmitted } from "@/modules/onboarding/professional";
import { verifyCsrfRequest } from "@/modules/auth/request-security";
import { deriveCoarseLocation } from "@/modules/listings/location";

export async function POST(request: Request) {
  if (!verifyCsrfRequest(request)) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }
  const authorization = authorizeRequest(request, [{ resource: Resource.LISTING, action: Action.CREATE }]);
  if (!authorization.ok) return authorization.response;
  if (!(await professionalOnboardingSubmitted(authorization.principal))) {
    return NextResponse.json({ error: "Complete your professional onboarding before creating a listing." }, { status: 409 });
  }

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
  const listing = await db.$transaction(async (tx) => {
    const created = await tx.listing.create({
      data: {
      title: d.title,
      description: d.description,
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
              ownerId: authorization.principal.userId,
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
  return NextResponse.json({ ok: true, id: listing.id }, { status: 201 });
}
