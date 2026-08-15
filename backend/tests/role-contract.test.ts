import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { APPLICATION_ROLES, APPLICATION_TO_DATABASE_ROLE, DATABASE_ROLES, DATABASE_TO_APPLICATION_ROLE } from "../src/modules/auth/role-contract";

describe("cross-workspace role contract", () => {
  it("keeps deployment-local contract packages synchronized with the canonical source", () => {
    const canonical = readFileSync(new URL("../../packages/contracts/src/index.ts", import.meta.url), "utf8");
    const backendMirror = readFileSync(new URL("../src/modules/auth/role-contract.ts", import.meta.url), "utf8");
    const frontendMirror = readFileSync(new URL("../../frontend/src/lib/role-contract.ts", import.meta.url), "utf8");
    const mobileMirror = readFileSync(new URL("../../mobile/vendor/contracts/src/index.ts", import.meta.url), "utf8");

    expect(backendMirror).toBe(canonical);
    expect(frontendMirror).toBe(canonical);
    expect(mobileMirror).toBe(canonical);
  });

  it("matches every Prisma UserRole and maps every database/application role", () => {
    const schema = readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8");
    const body = schema.match(/enum UserRole\s*\{([^}]+)\}/)?.[1];
    expect(body).toBeTruthy();
    const prismaRoles = body!.split(/\r?\n/).map(line => line.trim().split(/\s+/)[0]).filter(Boolean);
    expect(prismaRoles.sort()).toEqual([...DATABASE_ROLES].sort());
    expect(Object.keys(DATABASE_TO_APPLICATION_ROLE).sort()).toEqual([...DATABASE_ROLES].sort());
    expect(Object.keys(APPLICATION_TO_DATABASE_ROLE).sort()).toEqual([...APPLICATION_ROLES].sort());
  });
});
