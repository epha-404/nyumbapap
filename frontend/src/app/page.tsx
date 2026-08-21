import { Marketplace, type MarketplaceStats } from "@/components/marketplace";
import { backendFetch } from "@/lib/server-api";
import { demoListings } from "@/modules/listings/demo-data";
import type { ListingCard } from "@/modules/listings/types";
import { listingCardsFromApi, type PublicListingsPayload } from "@/modules/listings/public-api";

export const dynamic = "force-dynamic";

const unavailableStats: MarketplaceStats = { vacantHomes: 0, townsCovered: 0, verifiedLandlordPercent: null, successfulUnlocks: 0 };

async function marketplaceData(): Promise<{ listings: ListingCard[]; towns: string[]; stats: MarketplaceStats }> {
  try {
    const response = await backendFetch("listings");
    if (!response.ok) return { listings: demoListings, towns: [...new Set(demoListings.map(listing => listing.town))].sort(), stats: unavailableStats };
    const payload = await response.json() as PublicListingsPayload<MarketplaceStats>;
    if (!payload.data.length) return { listings: demoListings, towns: payload.towns, stats: payload.stats };
    return { stats: payload.stats, towns: payload.towns, listings: listingCardsFromApi(payload.data) };
  } catch {
    return { listings: demoListings, towns: [...new Set(demoListings.map(listing => listing.town))].sort(), stats: unavailableStats };
  }
}

export default async function HomePage() {
  const data = await marketplaceData();
  return <Marketplace initialListings={data.listings} initialTowns={data.towns} stats={data.stats} />;
}
