import { describe, expect, it } from "vitest";
import { listingSearchPath, normalizedBudgetRange, townFromGeocode } from "@/lib/listing-search";

describe("mobile listing search", () => {
  it("builds a combined server query and omits detected town when a town is selected", () => {
    const detected = { town: "Kisumu", latitude: -0.1022, longitude: 34.7617 };
    expect(listingSearchPath({ town: "Nakuru", minRent: 15000, maxRent: 40000 }, detected)).toBe("listings?town=Nakuru&minRent=15000&maxRent=40000");
    expect(listingSearchPath({ town: null, minRent: null, maxRent: null }, detected)).toBe("listings?nearTown=Kisumu&nearLat=-0.1022&nearLng=34.7617");
  });

  it("keeps the budget range valid", () => {
    expect(normalizedBudgetRange({ town: null, minRent: 50000, maxRent: 30000 }, "min")).toMatchObject({ minRent: 50000, maxRent: 50000 });
    expect(normalizedBudgetRange({ town: null, minRent: 50000, maxRent: 30000 }, "max")).toMatchObject({ minRent: 30000, maxRent: 30000 });
  });

  it("derives the best available town label from device geocoding", () => {
    expect(townFromGeocode({ city: "Nairobi", region: "Nairobi County" })).toBe("Nairobi");
    expect(townFromGeocode({ subregion: "Kiambu" })).toBe("Kiambu");
  });
});
