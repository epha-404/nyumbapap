import type { Prisma } from "@prisma/client";
import type { Coordinates } from "./location";

export const DETECTED_LOCATION_RADIUS_METRES = 50_000;

type GeoCommandRunner = {
  $runCommandRaw(command: Prisma.InputJsonObject): Promise<Prisma.JsonObject>;
};

type GeoNearDocument = {
  _id?: unknown;
  distance_metres?: unknown;
};

export type NearbyProperty = { propertyId: string; distanceMetres: number };

export function nearbyPropertiesCommand(point: Coordinates, maxDistanceMetres = DETECTED_LOCATION_RADIUS_METRES, limit = 500): Prisma.InputJsonObject {
  return {
    aggregate: "properties",
    pipeline: [
      {
        $geoNear: {
          near: { type: "Point", coordinates: [point.longitude, point.latitude] },
          distanceField: "distance_metres",
          maxDistance: maxDistanceMetres,
          spherical: true,
          key: "search_point"
        }
      },
      { $limit: limit },
      { $project: { _id: 1, distance_metres: 1 } }
    ],
    cursor: {}
  };
}

export async function propertiesNearCoordinates(
  runner: GeoCommandRunner,
  point: Coordinates,
  options: { maxDistanceMetres?: number; limit?: number } = {}
): Promise<NearbyProperty[]> {
  const result = await runner.$runCommandRaw(nearbyPropertiesCommand(
    point,
    options.maxDistanceMetres ?? DETECTED_LOCATION_RADIUS_METRES,
    options.limit ?? 500
  ));
  const cursor = result.cursor as { firstBatch?: GeoNearDocument[] } | undefined;
  return (cursor?.firstBatch ?? []).flatMap(document => {
    if (typeof document._id !== "string" || typeof document.distance_metres !== "number") return [];
    return [{ propertyId: document._id, distanceMetres: document.distance_metres }];
  });
}

export function prioritizeNearbyProperties<T extends { unit: { property: { id: string } } }>(
  listings: readonly T[],
  nearbyPropertyIds: readonly string[]
) {
  if (!nearbyPropertyIds.length) return [...listings];
  const nearby = new Set(nearbyPropertyIds);
  const matching = listings.filter(listing => nearby.has(listing.unit.property.id));
  if (!matching.length) return [...listings];
  const matchingSet = new Set(matching);
  return [...matching, ...listings.filter(listing => !matchingSet.has(listing))];
}
