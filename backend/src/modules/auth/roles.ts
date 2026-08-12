import type { UserRole } from "@prisma/client";

export enum Role {
  ADMIN = "ADMIN",
  LANDLORD = "LANDLORD",
  AGENT = "AGENT",
  CLIENT = "CLIENT",
  VERIFIER = "VERIFIER",
  SUPPORT = "SUPPORT"
}

export enum Resource {
  SESSION = "SESSION",
  USER = "USER",
  LISTING = "LISTING",
  IDENTITY = "IDENTITY",
  PAYMENT = "PAYMENT",
  REFUND = "REFUND",
  LANDLORD_FINANCE = "LANDLORD_FINANCE",
  CLIENT_ACTIVITY = "CLIENT_ACTIVITY",
  ONBOARDING = "ONBOARDING"
}

export enum Action {
  READ = "READ",
  READ_SELF = "READ_SELF",
  CREATE = "CREATE",
  UPDATE = "UPDATE",
  UPDATE_SELF = "UPDATE_SELF",
  DELETE = "DELETE",
  READ_ANY = "READ_ANY",
  UPDATE_ANY = "UPDATE_ANY",
  DELETE_ANY = "DELETE_ANY",
  MODERATE = "MODERATE",
  EXECUTE = "EXECUTE"
}

type PermissionMatrix = Readonly<Record<Role, Readonly<Record<Resource, readonly Action[]>>>>;

export const PERMISSION_MATRIX: PermissionMatrix = {
  [Role.ADMIN]: {
    [Resource.SESSION]: [Action.READ],
    [Resource.USER]: [Action.READ, Action.READ_SELF, Action.CREATE, Action.UPDATE, Action.UPDATE_SELF, Action.DELETE],
    [Resource.LISTING]: [Action.READ, Action.READ_ANY, Action.CREATE, Action.UPDATE, Action.UPDATE_ANY, Action.DELETE, Action.DELETE_ANY, Action.MODERATE],
    [Resource.IDENTITY]: [Action.READ, Action.READ_SELF, Action.CREATE, Action.UPDATE, Action.UPDATE_SELF, Action.MODERATE],
    [Resource.PAYMENT]: [Action.READ, Action.CREATE, Action.UPDATE],
    [Resource.REFUND]: [Action.READ, Action.EXECUTE],
    [Resource.LANDLORD_FINANCE]: [Action.READ],
    [Resource.CLIENT_ACTIVITY]: [Action.READ, Action.CREATE],
    [Resource.ONBOARDING]: [Action.READ, Action.READ_ANY, Action.UPDATE, Action.UPDATE_ANY]
  },
  [Role.LANDLORD]: {
    [Resource.SESSION]: [Action.READ],
    [Resource.USER]: [Action.READ_SELF, Action.UPDATE_SELF],
    [Resource.LISTING]: [Action.READ, Action.CREATE, Action.UPDATE, Action.DELETE],
    [Resource.IDENTITY]: [Action.READ_SELF, Action.CREATE, Action.UPDATE_SELF],
    [Resource.PAYMENT]: [Action.READ],
    [Resource.REFUND]: [],
    [Resource.LANDLORD_FINANCE]: [Action.READ],
    [Resource.CLIENT_ACTIVITY]: [],
    [Resource.ONBOARDING]: [Action.READ_SELF, Action.UPDATE_SELF]
  },
  [Role.AGENT]: {
    [Resource.SESSION]: [Action.READ],
    [Resource.USER]: [Action.READ_SELF, Action.UPDATE_SELF],
    [Resource.LISTING]: [Action.READ, Action.CREATE, Action.UPDATE, Action.DELETE],
    [Resource.IDENTITY]: [Action.READ_SELF, Action.CREATE, Action.UPDATE_SELF],
    [Resource.PAYMENT]: [],
    [Resource.REFUND]: [],
    [Resource.LANDLORD_FINANCE]: [],
    [Resource.CLIENT_ACTIVITY]: [],
    [Resource.ONBOARDING]: [Action.READ_SELF, Action.UPDATE_SELF]
  },
  [Role.CLIENT]: {
    [Resource.SESSION]: [Action.READ],
    [Resource.USER]: [Action.READ_SELF, Action.UPDATE_SELF],
    [Resource.LISTING]: [Action.READ],
    [Resource.IDENTITY]: [Action.READ_SELF, Action.CREATE, Action.UPDATE_SELF],
    [Resource.PAYMENT]: [Action.READ, Action.CREATE],
    [Resource.REFUND]: [],
    [Resource.LANDLORD_FINANCE]: [],
    [Resource.CLIENT_ACTIVITY]: [Action.READ, Action.CREATE],
    [Resource.ONBOARDING]: []
  },
  [Role.VERIFIER]: {
    [Resource.SESSION]: [Action.READ],
    [Resource.USER]: [Action.READ_SELF],
    [Resource.LISTING]: [Action.READ, Action.READ_ANY, Action.MODERATE],
    [Resource.IDENTITY]: [Action.READ, Action.MODERATE],
    [Resource.PAYMENT]: [],
    [Resource.REFUND]: [],
    [Resource.LANDLORD_FINANCE]: [],
    [Resource.CLIENT_ACTIVITY]: [],
    [Resource.ONBOARDING]: []
  },
  [Role.SUPPORT]: {
    [Resource.SESSION]: [Action.READ],
    [Resource.USER]: [Action.READ_SELF],
    [Resource.LISTING]: [Action.READ, Action.READ_ANY],
    [Resource.IDENTITY]: [],
    [Resource.PAYMENT]: [Action.READ],
    [Resource.REFUND]: [Action.READ],
    [Resource.LANDLORD_FINANCE]: [],
    [Resource.CLIENT_ACTIVITY]: [],
    [Resource.ONBOARDING]: []
  }
};

export function can(role: Role, resource: Resource, action: Action) {
  return PERMISSION_MATRIX[role][resource].includes(action);
}

export function roleFromStoredValue(value: unknown): Role | null {
  if (value === "TENANT" || value === Role.CLIENT) return Role.CLIENT;
  if (value === "FINANCE" || value === Role.SUPPORT) return Role.SUPPORT;
  if (Object.values(Role).includes(value as Role)) return value as Role;
  return null;
}

export function roleToDatabase(role: Role): UserRole {
  if (role === Role.CLIENT) return "TENANT";
  return role;
}
