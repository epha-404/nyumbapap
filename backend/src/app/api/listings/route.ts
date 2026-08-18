import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";
import { badgeFor, VerificationKind } from "@/modules/verification/policy";
import { landlordVerificationBadge, rankPublicListings } from "@/modules/listings/ranking";

const querySchema = z.object({ town: z.string().max(80).optional(), maxRent: z.coerce.number().int().positive().optional(), take: z.coerce.number().int().min(1).max(50).default(24) });
export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Invalid search parameters" }, { status: 400 });
  const { town, maxRent, take } = parsed.data;
  const [rawListings, vacantHomes, coveredTowns, totalLandlords, verifiedLandlords, successfulUnlocks] = await Promise.all([db.listing.findMany({
    where: { status: "PUBLISHED", lifecycleStatus: "ACTIVE", ...(town ? { unit: { property: { town: { equals: town, mode: "insensitive" } } } } : {}), ...(maxRent ? { unit: { monthlyRentKes: { lte: maxRent } } } : {}) },
    take: Math.min(150, take * 3),
    orderBy: { publishedAt: "desc" },
    select: { id: true, title: true, verificationState: true, expiresAt: true, publishedAt: true, unit: { select: { unitType: true, bathrooms: true, sizeSquareMetres: true, monthlyRentKes: true, property: { select: { town: true, approximateArea: true, approximateLatitude: true, approximateLongitude: true, owner: { select: { landlordProfile: { select: { verificationState: true } } } } } } } }, media: { where: { moderationState: "APPROVED" }, orderBy: { sortOrder: "asc" }, take: 1, select: { id: true, width: true, height: true } } }
  }),
    db.listing.count({ where: { status: "PUBLISHED", lifecycleStatus: "ACTIVE" } }),
    db.property.groupBy({ by: ["town"], where: { units: { some: { listings: { some: { status: "PUBLISHED", lifecycleStatus: "ACTIVE" } } } } } }),
    db.landlordProfile.count(),
    db.landlordProfile.count({ where: { verificationState: "APPROVED" } }),
    db.tenantUnlock.count()
  ]);
  const listings = rankPublicListings(rawListings.map(listing => ({ ...listing, landlordVerificationState: listing.unit.property.owner.landlordProfile?.verificationState ?? null }))).slice(0, take);
  // The projection above is an allow-list: protected address, exact coordinates and contact fields cannot escape.
  return NextResponse.json({ data: listings.map((listing) => {
    const { owner: _owner, ...property } = listing.unit.property;
    const { landlordVerificationState, ...publicListing } = listing;
    return {
      ...publicListing,
      unit: { ...listing.unit, property },
      badge: badgeFor(VerificationKind.LISTING, listing.verificationState, listing.expiresAt),
      landlordBadge: landlordVerificationBadge(landlordVerificationState),
      media: listing.media.map((image) => ({ ...image, url: `/api/listing-media/${image.id}` }))
    };
  }), stats: {
    vacantHomes,
    townsCovered: coveredTowns.length,
    verifiedLandlordPercent: totalLandlords ? Math.round((verifiedLandlords / totalLandlords) * 100) : null,
    successfulUnlocks
  } });
}
