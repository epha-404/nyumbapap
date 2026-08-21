import { describe, expect, it } from "vitest";
import { listingInputSchema } from "@/modules/listings/listing-data";

const input = {
  title: "Bright apartment",
  description: "A bright apartment close to transport and local shops.",
  county: "Kirinyaga",
  town: "Nyangati",
  area: "Nyangati ward",
  contact: "0712345678",
  unitType: "1 Bedroom",
  bedrooms: 1,
  bathrooms: 1,
  size: 45,
  rent: 18000,
  deposit: 18000,
  latitude: -0.55,
  longitude: 37.27,
  locationConfirmed: true
};

describe("listing exact-location input", () => {
  it("requires a confirmed Kenyan map pin but not an exact-address string", () => {
    expect(listingInputSchema.parse(input).address).toBe("");
    expect(listingInputSchema.safeParse({ ...input, locationConfirmed: false }).success).toBe(false);
  });
});
