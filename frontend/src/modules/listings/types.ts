export type ListingCard = {
  id: string;
  title: string;
  town: string;
  approximateArea: string;
  unitType: string;
  monthlyRentKes: number;
  sizeSquareMetres: number;
  bathrooms: number;
  verified: boolean;
  verificationLabel?: string;
  verificationExpiresAt?: string | null;
  imageUrl: string;
};

export type PublicListing = ListingCard & {
  approximateLatitude?: number;
  approximateLongitude?: number;
};

// Exact address, exact coordinates and owner contacts deliberately do not exist in public DTOs.
