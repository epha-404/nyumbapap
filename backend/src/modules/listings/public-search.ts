import { z } from "zod";

const optionalTown = z.string().trim().min(2).max(80).optional();

export const publicListingSearchSchema = z.object({
  town: optionalTown,
  nearTown: optionalTown,
  minRent: z.coerce.number().int().min(0).optional(),
  maxRent: z.coerce.number().int().positive().optional(),
  take: z.coerce.number().int().min(1).max(50).default(24)
}).superRefine(({ minRent, maxRent }, context) => {
  if (minRent !== undefined && maxRent !== undefined && minRent > maxRent) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Minimum rent cannot exceed maximum rent", path: ["minRent"] });
  }
});

export type PublicListingSearch = z.infer<typeof publicListingSearchSchema>;

export function publicListingWhere(filters: Pick<PublicListingSearch, "town" | "minRent" | "maxRent">) {
  const rent = {
    ...(filters.minRent !== undefined ? { gte: filters.minRent } : {}),
    ...(filters.maxRent !== undefined ? { lte: filters.maxRent } : {})
  };
  const unit = {
    ...(filters.town ? { property: { town: { equals: filters.town, mode: "insensitive" as const } } } : {}),
    ...(Object.keys(rent).length ? { monthlyRentKes: rent } : {})
  };
  return {
    status: "PUBLISHED" as const,
    lifecycleStatus: "ACTIVE" as const,
    ...(Object.keys(unit).length ? { unit } : {})
  };
}

export function normalizeAvailableTowns(rows: readonly { town: string }[]) {
  return [...new Set(rows.map(row => row.town.trim()).filter(Boolean))].sort((left, right) => left.localeCompare(right, "en-KE"));
}

export function prioritizeDetectedTown<T extends { unit: { property: { town: string } } }>(listings: readonly T[], nearTown?: string) {
  if (!nearTown) return [...listings];
  const normalized = nearTown.trim().toLocaleLowerCase("en-KE");
  const matching = listings.filter(listing => listing.unit.property.town.trim().toLocaleLowerCase("en-KE") === normalized);
  if (!matching.length) return [...listings];
  const matchingSet = new Set(matching);
  return [...matching, ...listings.filter(listing => !matchingSet.has(listing))];
}
