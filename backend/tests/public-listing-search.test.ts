import { describe, expect, it } from "vitest";
import { normalizeAvailableTowns, prioritizeDetectedTown, publicListingSearchSchema, publicListingWhere } from "@/modules/listings/public-search";

describe("public listing search", () => {
  it("combines a selected town with minimum and maximum rent", () => {
    const filters = publicListingSearchSchema.parse({ town: "Nakuru", minRent: "15000", maxRent: "40000" });
    expect(publicListingWhere(filters)).toEqual({
      status: "PUBLISHED",
      lifecycleStatus: "ACTIVE",
      unit: {
        property: { town: { equals: "Nakuru", mode: "insensitive" } },
        monthlyRentKes: { gte: 15000, lte: 40000 }
      }
    });
  });

  it("rejects an inverted budget range", () => {
    expect(publicListingSearchSchema.safeParse({ minRent: "50000", maxRent: "20000" }).success).toBe(false);
  });

  it("accepts a paired coarse Kenyan location hint and rejects partial or foreign coordinates", () => {
    expect(publicListingSearchSchema.safeParse({ nearLat: "-1.286", nearLng: "36.817" }).success).toBe(true);
    expect(publicListingSearchSchema.safeParse({ nearLat: "-1.286" }).success).toBe(false);
    expect(publicListingSearchSchema.safeParse({ nearLat: "51.507", nearLng: "-0.127" }).success).toBe(false);
  });

  it("returns distinct sorted active-town values", () => {
    expect(normalizeAvailableTowns([{ town: "Nairobi" }, { town: " Kisumu " }, { town: "Nairobi" }])).toEqual(["Kisumu", "Nairobi"]);
  });

  it("prioritizes a detected town and preserves recent fallback order when there is no match", () => {
    const listings = ["Nairobi", "Kisumu", "Nakuru"].map((town, index) => ({ id: index, unit: { property: { town } } }));
    expect(prioritizeDetectedTown(listings, "Kisumu").map(listing => listing.unit.property.town)).toEqual(["Kisumu", "Nairobi", "Nakuru"]);
    expect(prioritizeDetectedTown(listings, "Mombasa")).toEqual(listings);
  });
});
