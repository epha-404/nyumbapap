import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("listing lifecycle migration", () => {
  it("defaults new records and backfills existing listings from created_at", () => {
    const schema = readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8");
    const setup = readFileSync(new URL("../scripts/setup-mongodb.ts", import.meta.url), "utf8");
    expect(schema).toMatch(/lifecycleStatus\s+ListingLifecycleStatus\s+@default\(ACTIVE\)/);
    expect(schema).toMatch(/lastConfirmedAt\s+DateTime\s+@default\(now\(\)\)/);
    expect(setup).toContain('last_confirmed_at: { $ifNull: ["$created_at", "$$NOW"] }');
  });

  it("installs the MongoDB 2dsphere index used by public proximity ranking", () => {
    const setup = readFileSync(new URL("../scripts/setup-mongodb.ts", import.meta.url), "utf8");
    expect(setup).toContain('createIndex({ search_point: "2dsphere" }');
    expect(setup).toContain('name: "properties_search_point_2dsphere"');
  });
});
