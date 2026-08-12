import { Marketplace, type MarketplaceStats } from "@/components/marketplace";
import { backendFetch } from "@/lib/server-api";
import { demoListings } from "@/modules/listings/demo-data";
import type { ListingCard } from "@/modules/listings/types";

type ApiListing = {
  id: string;
  title: string;
  verificationState: string;
  badge?: { label: string; state: string; expiresAt: string | null };
  unit: {
    unitType: string;
    bathrooms: number;
    sizeSquareMetres: number | null;
    monthlyRentKes: number;
    property: { town: string; approximateArea: string };
  };
  media: Array<{ id: string; url: string; width: number; height: number }>;
};

export const dynamic = "force-dynamic";

const unavailableStats: MarketplaceStats = { vacantHomes: 0, townsCovered: 0, verifiedLandlordPercent: null, successfulUnlocks: 0 };

async function marketplaceData(): Promise<{ listings: ListingCard[]; stats: MarketplaceStats }> {
  try {
    const response = await backendFetch("listings");
    if (!response.ok) return { listings: demoListings, stats: unavailableStats };
    const payload = await response.json() as { data: ApiListing[]; stats: MarketplaceStats };
    if (!payload.data.length) return { listings: demoListings, stats: payload.stats };

    return { stats: payload.stats, listings: payload.data.map((listing, index) => ({
      id: listing.id,
      title: listing.title,
      town: listing.unit.property.town,
      approximateArea: listing.unit.property.approximateArea,
      unitType: listing.unit.unitType,
      monthlyRentKes: listing.unit.monthlyRentKes,
      sizeSquareMetres: listing.unit.sizeSquareMetres ?? 0,
      bathrooms: listing.unit.bathrooms,
      verified: listing.badge?.state === "verified" || listing.badge?.state === "expiring",
      verificationLabel: listing.badge?.state === "expiring" ? `${listing.badge.label} - expiring soon` : listing.badge?.label,
      verificationExpiresAt: listing.badge?.expiresAt,
      imageUrl: listing.media[0]?.url ?? demoListings[index % demoListings.length].imageUrl
    })) };
  } catch {
    return { listings: demoListings, stats: unavailableStats };
  }
}

export default async function HomePage() {
  const data = await marketplaceData();
  return <Marketplace initialListings={data.listings} stats={data.stats} />;
}
