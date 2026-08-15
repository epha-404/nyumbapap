import { describe, expect, it } from "vitest";
import {
  Action,
  PERMISSION_MATRIX,
  requirePermission,
  requireResourceOwner,
  Resource,
  Role,
  roleFromStoredValue,
  parseSessionRole
} from "@/modules/auth/authorization";

describe("authorization", () => {
  it("exposes exactly the six application roles", () => {
    expect(Object.values(Role)).toEqual([
      "ADMIN",
      "LANDLORD",
      "AGENT",
      "CLIENT",
      "VERIFIER",
      "SUPPORT"
    ]);
  });

  it("normalizes legacy database roles before authorization", () => {
    expect(roleFromStoredValue("TENANT")).toBe(Role.CLIENT);
    expect(roleFromStoredValue("FINANCE")).toBe(Role.SUPPORT);
    expect(parseSessionRole("UNKNOWN")).toBeNull();
  });

  it("defines every resource explicitly for every role", () => {
    for (const role of Object.values(Role)) {
      expect(Object.keys(PERMISSION_MATRIX[role]).sort()).toEqual(Object.values(Resource).sort());
    }
  });

  it("rejects anonymous access", () => {
    expect(() => requirePermission(null, { resource: Resource.LISTING, action: Action.READ })).toThrow("UNAUTHENTICATED");
  });

  it("lets agents manage listings but not landlord finances", () => {
    const agent = { userId: "a1", role: Role.AGENT };
    expect(() => requirePermission(agent, { resource: Resource.LISTING, action: Action.CREATE })).not.toThrow();
    expect(() => requirePermission(agent, { resource: Resource.LISTING, action: Action.UPDATE })).not.toThrow();
    expect(() => requirePermission(agent, { resource: Resource.LANDLORD_FINANCE, action: Action.READ })).toThrow("FORBIDDEN");
  });

  it("prevents landlords and agents from mutating another owner's listing", () => {
    const landlord = { userId: "landlord-1", role: Role.LANDLORD };
    const agent = { userId: "agent-1", role: Role.AGENT };
    expect(() => requireResourceOwner(landlord, Resource.LISTING, "landlord-1", Action.UPDATE)).not.toThrow();
    expect(() => requireResourceOwner(landlord, Resource.LISTING, "landlord-2", Action.UPDATE)).toThrow("FORBIDDEN");
    expect(() => requireResourceOwner(agent, Resource.LISTING, "agent-1", Action.DELETE)).not.toThrow();
    expect(() => requireResourceOwner(agent, Resource.LISTING, "landlord-1", Action.DELETE)).toThrow("FORBIDDEN");
  });

  it("allows admins, but not agents, to cross listing ownership boundaries", () => {
    const admin = { userId: "admin-1", role: Role.ADMIN };
    const agent = { userId: "agent-1", role: Role.AGENT };
    expect(() => requireResourceOwner(admin, Resource.LISTING, "landlord-1", Action.UPDATE)).not.toThrow();
    expect(() => requireResourceOwner(agent, Resource.LISTING, "landlord-1", Action.READ)).toThrow("FORBIDDEN");
  });

  it("limits verifiers to moderation without financial or user-deletion access", () => {
    const verifier = { userId: "v1", role: Role.VERIFIER };
    expect(() => requirePermission(verifier, { resource: Resource.IDENTITY, action: Action.MODERATE })).not.toThrow();
    expect(() => requirePermission(verifier, { resource: Resource.LISTING, action: Action.MODERATE })).not.toThrow();
    expect(() => requirePermission(verifier, { resource: Resource.PAYMENT, action: Action.READ })).toThrow("FORBIDDEN");
    expect(() => requirePermission(verifier, { resource: Resource.USER, action: Action.DELETE })).toThrow("FORBIDDEN");
  });

  it("lets support read payments and refunds without writing listings", () => {
    const support = { userId: "s1", role: Role.SUPPORT };
    expect(() => requirePermission(support, { resource: Resource.PAYMENT, action: Action.READ })).not.toThrow();
    expect(() => requirePermission(support, { resource: Resource.REFUND, action: Action.READ })).not.toThrow();
    expect(() => requirePermission(support, { resource: Resource.LISTING, action: Action.CREATE })).toThrow("FORBIDDEN");
    expect(() => requirePermission(support, { resource: Resource.LISTING, action: Action.MODERATE })).toThrow("FORBIDDEN");
    expect(() => requirePermission(support, { resource: Resource.IDENTITY, action: Action.READ })).toThrow("FORBIDDEN");
    expect(() => requirePermission(support, { resource: Resource.REFUND, action: Action.EXECUTE })).toThrow("FORBIDDEN");
  });

  it("enforces ownership through the same matrix", () => {
    const client = { userId: "u1", role: Role.CLIENT };
    expect(() => requireResourceOwner(client, Resource.USER, "u1", Action.READ_SELF)).not.toThrow();
    expect(() => requireResourceOwner(client, Resource.USER, "u2", Action.READ_SELF)).toThrow("FORBIDDEN");
  });
});
