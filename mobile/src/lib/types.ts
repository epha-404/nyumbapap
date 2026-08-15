import type { AppRole } from "@nyumbapap/contracts";
export type Role = AppRole;
export type Session = { userId: string; role: Role; displayName: string; email?: string | null; phone?: string | null; requiresEmailCapture?: boolean };
export type ListingCard = { id: string; title: string; badge?: { label: string; state: string; expiresAt: string | null }; unit: { unitType: string; bathrooms: number; sizeSquareMetres: number | null; monthlyRentKes: number; property: { town: string; approximateArea: string } }; media: Array<{ id: string; url: string; width: number; height: number }> };
export type ListingDetail = ListingCard & { description: string; unit: ListingCard["unit"] & { bedrooms: number; depositKes: number | null; amenities: unknown; property: ListingCard["unit"]["property"] & { county: string } }; images: Array<{ id: string; url: string; width: number; height: number }>; unlockFeeKes: number; hasPaidUnlock: boolean; signedIn: boolean };
