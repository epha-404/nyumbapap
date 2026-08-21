import { describe, expect, it, vi } from "vitest";
import { nearbyPropertiesCommand, prioritizeNearbyProperties, propertiesNearCoordinates } from "@/modules/listings/geospatial-search";

const radians = (degrees: number) => degrees * Math.PI / 180;
function knownDistanceMetres(from: { latitude: number; longitude: number }, to: { latitude: number; longitude: number }) {
  const latitudeDelta = radians(to.latitude - from.latitude);
  const longitudeDelta = radians(to.longitude - from.longitude);
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(from.latitude)) * Math.cos(radians(to.latitude)) * Math.sin(longitudeDelta / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

describe("MongoDB geospatial listing search", () => {
  it("uses the properties 2dsphere field and a metre-bounded $geoNear aggregation", () => {
    const command = nearbyPropertiesCommand({ latitude: -1.286389, longitude: 36.817223 }, 5_000, 25);
    expect(command).toEqual({
      aggregate: "properties",
      pipeline: [
        { $geoNear: {
          near: { type: "Point", coordinates: [36.817223, -1.286389] },
          distanceField: "distance_metres",
          maxDistance: 5_000,
          spherical: true,
          key: "search_point"
        } },
        { $limit: 25 },
        { $project: { _id: 1, distance_metres: 1 } }
      ],
      cursor: {}
    });
  });

  it("includes a known nearby point and excludes a known point outside the radius", async () => {
    const nairobi = { latitude: -1.286389, longitude: 36.817223 };
    const westlands = { latitude: -1.2676, longitude: 36.8108 };
    const thika = { latitude: -1.0332, longitude: 37.0693 };
    const westlandsDistance = knownDistanceMetres(nairobi, westlands);
    const thikaDistance = knownDistanceMetres(nairobi, thika);
    expect(westlandsDistance).toBeGreaterThan(2_000);
    expect(westlandsDistance).toBeLessThan(5_000);
    expect(thikaDistance).toBeGreaterThan(35_000);

    const runner = { $runCommandRaw: vi.fn().mockResolvedValue({ cursor: { firstBatch: [
      { _id: "westlands-property", distance_metres: westlandsDistance }
    ] } }) };
    await expect(propertiesNearCoordinates(runner, nairobi, { maxDistanceMetres: 5_000 })).resolves.toEqual([
      { propertyId: "westlands-property", distanceMetres: westlandsDistance }
    ]);
  });

  it("prioritizes only properties returned by the spatial query, not every matching town label", () => {
    const listings = [
      { id: "recent-far", unit: { property: { id: "far", town: "Nairobi" } } },
      { id: "near", unit: { property: { id: "near", town: "Kiambu" } } },
      { id: "older-same-label", unit: { property: { id: "same-label", town: "Nairobi" } } }
    ];
    expect(prioritizeNearbyProperties(listings, ["near"]).map(listing => listing.id)).toEqual([
      "near", "recent-far", "older-same-label"
    ]);
    expect(prioritizeNearbyProperties(listings, ["missing"])).toEqual(listings);
  });
});
