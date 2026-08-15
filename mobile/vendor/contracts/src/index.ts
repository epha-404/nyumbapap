export const APP_ROLE = {
  ADMIN: "ADMIN",
  LANDLORD: "LANDLORD",
  AGENT: "AGENT",
  CLIENT: "CLIENT",
  VERIFIER: "VERIFIER",
  SUPPORT: "SUPPORT"
} as const;

export type AppRole = typeof APP_ROLE[keyof typeof APP_ROLE];
export const APPLICATION_ROLES = Object.freeze(Object.values(APP_ROLE)) as readonly AppRole[];

export const DATABASE_ROLES = ["TENANT", "LANDLORD", "AGENT", "VERIFIER", "SUPPORT", "FINANCE", "ADMIN"] as const;
export type DatabaseRole = typeof DATABASE_ROLES[number];

export const DATABASE_TO_APPLICATION_ROLE = {
  TENANT: APP_ROLE.CLIENT,
  LANDLORD: APP_ROLE.LANDLORD,
  AGENT: APP_ROLE.AGENT,
  VERIFIER: APP_ROLE.VERIFIER,
  SUPPORT: APP_ROLE.SUPPORT,
  FINANCE: APP_ROLE.SUPPORT,
  ADMIN: APP_ROLE.ADMIN
} as const satisfies Record<DatabaseRole, AppRole>;

export const APPLICATION_TO_DATABASE_ROLE = {
  ADMIN: "ADMIN",
  LANDLORD: "LANDLORD",
  AGENT: "AGENT",
  CLIENT: "TENANT",
  VERIFIER: "VERIFIER",
  SUPPORT: "SUPPORT"
} as const satisfies Record<AppRole, DatabaseRole>;

export function isApplicationRole(value: unknown): value is AppRole {
  return typeof value === "string" && (APPLICATION_ROLES as readonly string[]).includes(value);
}
