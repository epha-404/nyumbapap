export type LandlordVerificationState = "NOT_SUBMITTED" | "UNVERIFIED" | "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED" | null;

export function unverifiedLandlordRankingFactor() {
  const configured = Number(process.env.UNVERIFIED_LANDLORD_RANKING_FACTOR ?? 0.7);
  return Number.isFinite(configured) && configured > 0 && configured <= 1 ? configured : 0.7;
}

export function landlordVerificationBadge(state: LandlordVerificationState) {
  if (state === "UNVERIFIED") return { state: "unverified" as const, label: "Unverified landlord" };
  if (state === "APPROVED") return { state: "verified" as const, label: "Verified landlord" };
  return null;
}

export function rankPublicListings<T extends { publishedAt: Date | null; landlordVerificationState: LandlordVerificationState }>(listings: readonly T[], now = new Date()) {
  const unverifiedFactor = unverifiedLandlordRankingFactor();
  return listings.map(listing => {
    const ageDays = Math.max(0, (now.getTime() - (listing.publishedAt?.getTime() ?? 0)) / 86_400_000);
    const freshness = 1 / (1 + ageDays / 30);
    const verificationFactor = listing.landlordVerificationState === "UNVERIFIED" ? unverifiedFactor : 1;
    return { listing, score: freshness * verificationFactor };
  }).sort((left, right) => right.score - left.score || (right.listing.publishedAt?.getTime() ?? 0) - (left.listing.publishedAt?.getTime() ?? 0)).map(item => item.listing);
}
