import { randomInt } from "node:crypto";

export type Coordinates = { latitude: number; longitude: number };
export type CoarseLocation = Coordinates & { town: string; area: string };

export const KENYA_BOUNDS = {
  south: -4.9,
  west: 33.9,
  north: 5.1,
  east: 41.9
} as const;

export function coordinatesAreInKenya({ latitude, longitude }: Coordinates) {
  return Number.isFinite(latitude) && Number.isFinite(longitude)
    && !(latitude === 0 && longitude === 0)
    && latitude >= KENYA_BOUNDS.south && latitude <= KENYA_BOUNDS.north
    && longitude >= KENYA_BOUNDS.west && longitude <= KENYA_BOUNDS.east;
}

export function jitterCoordinates(exact: Coordinates, randomInteger = randomInt): Coordinates {
  if (!coordinatesAreInKenya(exact)) throw new Error("COORDINATES_OUTSIDE_KENYA");
  const radiusMetres = randomInteger(150, 401);
  const bearing = randomInteger(0, 360) * Math.PI / 180;
  const earthRadius = 6_371_000;
  const angularDistance = radiusMetres / earthRadius;
  const latitude = exact.latitude * Math.PI / 180;
  const longitude = exact.longitude * Math.PI / 180;
  const jitteredLatitude = Math.asin(
    Math.sin(latitude) * Math.cos(angularDistance)
      + Math.cos(latitude) * Math.sin(angularDistance) * Math.cos(bearing)
  );
  const jitteredLongitude = longitude + Math.atan2(
    Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(latitude),
    Math.cos(angularDistance) - Math.sin(latitude) * Math.sin(jitteredLatitude)
  );
  return {
    latitude: Number((jitteredLatitude * 180 / Math.PI).toFixed(6)),
    longitude: Number((jitteredLongitude * 180 / Math.PI).toFixed(6))
  };
}

type NominatimAddress = Record<string, string | undefined>;

function headers() {
  return { "user-agent": "NyumbaPap/0.1 (rental listing location service)", accept: "application/json" };
}

export async function locateKenyanAddress(address: string): Promise<Array<Coordinates & { label: string }>> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", address);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("countrycodes", "ke");
  url.searchParams.set("limit", "5");
  const response = await fetch(url, { headers: headers(), signal: AbortSignal.timeout(8_000) });
  if (!response.ok) throw new Error("GEOCODING_UNAVAILABLE");
  const body = await response.json() as Array<{ lat?: string; lon?: string; display_name?: string }>;
  return body.map((item) => ({ latitude: Number(item.lat), longitude: Number(item.lon), label: item.display_name ?? address }))
    .filter(coordinatesAreInKenya);
}

export async function deriveCoarseLocation(exact: Coordinates): Promise<CoarseLocation> {
  const point = jitterCoordinates(exact);
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("lat", String(point.latitude));
  url.searchParams.set("lon", String(point.longitude));
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("zoom", "14");
  url.searchParams.set("addressdetails", "1");
  const response = await fetch(url, { headers: headers(), signal: AbortSignal.timeout(8_000) });
  if (!response.ok) throw new Error("GEOCODING_UNAVAILABLE");
  const body = await response.json() as { address?: NominatimAddress };
  const address = body.address ?? {};
  const town = address.city ?? address.town ?? address.municipality ?? address.village ?? address.county;
  const area = address.suburb ?? address.neighbourhood ?? address.quarter ?? address.city_district ?? town;
  if (!town || !area) throw new Error("LOCATION_TEXT_UNRESOLVED");
  return { ...point, town, area };
}
