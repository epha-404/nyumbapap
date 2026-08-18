import { afterEach, describe, expect, it } from "vitest";
import { landlordVerificationBadge, rankPublicListings, unverifiedLandlordRankingFactor } from "@/modules/listings/ranking";

describe("public listing verification ranking", () => {
  afterEach(() => delete process.env.UNVERIFIED_LANDLORD_RANKING_FACTOR);

  it("ranks an equivalent verified listing above an unverified listing", () => {
    const publishedAt = new Date("2026-08-18T00:00:00.000Z");
    const listings = [
      { id: "unverified", publishedAt, landlordVerificationState: "UNVERIFIED" as const },
      { id: "verified", publishedAt, landlordVerificationState: "APPROVED" as const }
    ];
    expect(rankPublicListings(listings, publishedAt).map(listing => listing.id)).toEqual(["verified", "unverified"]);
  });

  it("reads a tunable factor and exposes the tenant-facing badge", () => {
    process.env.UNVERIFIED_LANDLORD_RANKING_FACTOR = "0.55";
    expect(unverifiedLandlordRankingFactor()).toBe(0.55);
    expect(landlordVerificationBadge("UNVERIFIED")).toEqual({ state: "unverified", label: "Unverified landlord" });
  });
});
