import { z } from "zod";
import { decryptField, encryptField } from "@/lib/crypto";
import { coordinatesAreInKenya } from "./location";

export const listingInputSchema = z.object({
  title: z.string().trim().min(5).max(120),
  description: z.string().trim().min(20).max(2000),
  county: z.string().trim().min(2).max(80),
  town: z.string().trim().min(2).max(80),
  area: z.string().trim().min(2).max(100),
  address: z.string().trim().max(200).optional().default(""),
  contact: z.string().trim().min(10).max(20),
  unitType: z.string().trim().min(2).max(40),
  bedrooms: z.coerce.number().int().min(0).max(20),
  bathrooms: z.coerce.number().int().min(1).max(20),
  size: z.coerce.number().int().min(10).max(10000),
  rent: z.coerce.number().int().min(1000).max(10000000),
  deposit: z.coerce.number().int().min(0).max(10000000)
}).and(z.object({
  latitude: z.coerce.number(),
  longitude: z.coerce.number(),
  locationConfirmed: z.union([z.literal(true), z.literal("true")])
})).refine((value) => coordinatesAreInKenya(value), {
  message: "Choose and confirm an exact location inside Kenya",
  path: ["latitude"]
});

function encryptionKey() {
  const key = process.env.FIELD_ENCRYPTION_KEY_BASE64;
  if (!key) throw new Error("FIELD_ENCRYPTION_KEY_BASE64 is required");
  return key;
}

export function protectListingField(value: string) {
  return encryptField(value, encryptionKey());
}

export function revealListingField(value: Buffer) {
  try {
    return decryptField(value, encryptionKey());
  } catch {
    // Compatibility for local seed data created before field encryption was enabled.
    return value.toString("utf8");
  }
}
