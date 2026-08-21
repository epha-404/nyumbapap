import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { badgeFor, VerificationKind } from "@/modules/verification/policy";
import { landlordVerificationBadge, rankPublicListings } from "@/modules/listings/ranking";
import { normalizeAvailableTowns, publicListingSearchSchema, publicListingWhere } from "@/modules/listings/public-search";
import { resolveTownAtCoordinates } from "@/modules/listings/location";
import { prioritizeNearbyProperties, propertiesNearCoordinates } from "@/modules/listings/geospatial-search";

const publicListingSelect = {
  id: true, title: true, verificationState: true, expiresAt: true, publishedAt: true,
  unit: { select: { unitType: true, bathrooms: true, sizeSquareMetres: true, monthlyRentKes: true, property: { select: { id: true, town: true, approximateArea: true, approximateLatitude: true, approximateLongitude: true, owner: { select: { landlordProfile: { select: { verificationState: true } } } } } } } },
  media: { where: { moderationState: "APPROVED" as const }, orderBy: { sortOrder: "asc" as const }, take: 1, select: { id: true, width: true, height: true } }
};

export async function GET(request: NextRequest) {
  const parsed = publicListingSearchSchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Invalid search parameters" }, { status: 400 });
  const { town, nearTown, nearLat, nearLng, minRent, maxRent, take } = parsed.data;
  const detectedTown = !town && nearTown
    ? nearTown
    : !town && nearLat !== undefined && nearLng !== undefined
      ? await resolveTownAtCoordinates({ latitude: nearLat, longitude: nearLng }).catch(() => undefined)
      : undefined;
  const where = publicListingWhere({ town, minRent, maxRent });
  const nearby = !town && nearLat !== undefined && nearLng !== undefined
    ? await propertiesNearCoordinates(db, { latitude: nearLat, longitude: nearLng }).catch(error => {
      console.error("MongoDB geospatial listing lookup failed", error);
      return [];
    })
    : [];
  const preferredListings = nearby.length
    ? db.listing.findMany({
      where: publicListingWhere({ minRent, maxRent, propertyIds: nearby.map(item => item.propertyId) }),
      take: Math.min(150, take * 3),
      orderBy: { publishedAt: "desc" },
      select: publicListingSelect
    })
    : Promise.resolve([]);
  const [rawListings, preferred, vacantHomes, coveredTowns, totalLandlords, verifiedLandlords, successfulUnlocks] = await Promise.all([db.listing.findMany({
    where,
    take: Math.min(150, take * 3),
    orderBy: { publishedAt: "desc" },
    select: publicListingSelect
  }),
    preferredListings,
    db.listing.count({ where: { status: "PUBLISHED", lifecycleStatus: "ACTIVE" } }),
    db.property.groupBy({ by: ["town"], where: { units: { some: { listings: { some: { status: "PUBLISHED", lifecycleStatus: "ACTIVE" } } } } } }),
    db.landlordProfile.count(),
    db.landlordProfile.count({ where: { verificationState: "APPROVED" } }),
    db.tenantUnlock.count()
  ]);
  const mergedListings = [...preferred, ...rawListings.filter(listing => !preferred.some(candidate => candidate.id === listing.id))];
  const ranked = rankPublicListings(mergedListings.map(listing => ({ ...listing, landlordVerificationState: listing.unit.property.owner.landlordProfile?.verificationState ?? null })));
  const listings = prioritizeNearbyProperties(ranked, nearby.map(item => item.propertyId)).slice(0, take);
  const towns = normalizeAvailableTowns(coveredTowns);
  // The projection above is an allow-list: protected address, exact coordinates and contact fields cannot escape.
  return NextResponse.json({ data: listings.map((listing) => {
    const { owner: _owner, id: _propertyId, ...property } = listing.unit.property;
    const { landlordVerificationState, ...publicListing } = listing;
    return {
      ...publicListing,
      unit: { ...listing.unit, property },
      badge: badgeFor(VerificationKind.LISTING, listing.verificationState, listing.expiresAt),
      landlordBadge: landlordVerificationBadge(landlordVerificationState),
      media: listing.media.map((image) => ({ ...image, url: `/api/listing-media/${image.id}` }))
    };
  }), towns, detectedTown: detectedTown ?? null, stats: {
    vacantHomes,
    townsCovered: towns.length,
    verifiedLandlordPercent: totalLandlords ? Math.round((verifiedLandlords / totalLandlords) * 100) : null,
    successfulUnlocks
  } });
}
