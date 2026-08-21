import { demoListings } from "./demo-data";
import type { ListingCard } from "./types";

export type ApiListing = {
  id: string;
  title: string;
  verificationState: string;
  badge?: { label: string; state: string; expiresAt: string | null };
  landlordBadge?: { label: string; state: "verified" | "unverified" } | null;
  unit: { unitType: string; bathrooms: number; sizeSquareMetres: number | null; monthlyRentKes: number; property: { town: string; approximateArea: string } };
  media: Array<{ id: string; url: string; width: number; height: number }>;
};

export type PublicListingsPayload<TStats> = { data: ApiListing[]; towns: string[]; detectedTown?: string | null; stats: TStats };

export function listingCardsFromApi(listings: readonly ApiListing[]): ListingCard[] {
  return listings.map((listing, index) => ({
    id: listing.id,
    title: listing.title,
    town: listing.unit.property.town,
    approximateArea: listing.unit.property.approximateArea,
    unitType: listing.unit.unitType,
    monthlyRentKes: listing.unit.monthlyRentKes,
    sizeSquareMetres: listing.unit.sizeSquareMetres ?? 0,
    bathrooms: listing.unit.bathrooms,
    verified: listing.badge?.state === "verified" || listing.badge?.state === "expiring",
    verificationLabel: listing.landlordBadge?.state === "unverified" ? listing.landlordBadge.label : listing.badge?.state === "expiring" ? `${listing.badge.label} - expiring soon` : listing.badge?.label,
    verificationExpiresAt: listing.badge?.expiresAt,
    landlordBadge: listing.landlordBadge,
    imageUrl: listing.media[0]?.url ?? demoListings[index % demoListings.length].imageUrl
  }));
}
