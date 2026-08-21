export type ListingSearchPreferences = { town: string | null; minRent: number | null; maxRent: number | null };

export const initialListingSearchPreferences: ListingSearchPreferences = { town: null, minRent: null, maxRent: null };

export type DetectedLocation = { town?: string | null; latitude: number; longitude: number };

export function listingSearchPath(preferences: ListingSearchPreferences, detected?: DetectedLocation | null) {
  const params = new URLSearchParams();
  if (preferences.town) params.set("town", preferences.town);
  if (preferences.minRent !== null) params.set("minRent", String(preferences.minRent));
  if (preferences.maxRent !== null) params.set("maxRent", String(preferences.maxRent));
  if (!preferences.town && detected) {
    if (detected.town) params.set("nearTown", detected.town);
    params.set("nearLat", String(detected.latitude));
    params.set("nearLng", String(detected.longitude));
  }
  const query = params.toString();
  return `listings${query ? `?${query}` : ""}`;
}

export function normalizedBudgetRange(preferences: ListingSearchPreferences, changed: "min" | "max") {
  const next = { ...preferences };
  if (next.minRent !== null && next.maxRent !== null && next.minRent > next.maxRent) {
    if (changed === "min") next.maxRent = next.minRent;
    else next.minRent = next.maxRent;
  }
  return next;
}

export function townFromGeocode(place: { city?: string | null; subregion?: string | null; region?: string | null; district?: string | null }) {
  return place.city?.trim() || place.district?.trim() || place.subregion?.trim() || place.region?.trim() || null;
}
