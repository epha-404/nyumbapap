import { NextResponse } from "next/server";
import { sessionFromRequest } from "./request-session";
import { Action, can, Resource, Role } from "./roles";

export { Action, PERMISSION_MATRIX, Resource, Role, roleFromStoredValue, parseSessionRole } from "./roles";

export type Principal = { userId: string; role: Role; displayName?: string };
export type Permission = Readonly<{ resource: Resource; action: Action }>;

export class AuthorizationError extends Error {
  constructor(public code: "UNAUTHENTICATED" | "FORBIDDEN") { super(code); }
}

export function authorizationErrorResponse(error: unknown) {
  const unauthenticated = error instanceof AuthorizationError && error.code === "UNAUTHENTICATED";
  return NextResponse.json(
    { error: unauthenticated ? "Sign in required" : "You do not have permission to perform this action" },
    { status: unauthenticated ? 401 : 403 }
  );
}

export function requirePermission(principal: Principal | null, permission: Permission) {
  if (!principal) throw new AuthorizationError("UNAUTHENTICATED");
  if (!can(principal.role, permission.resource, permission.action)) throw new AuthorizationError("FORBIDDEN");
  return principal;
}

export function requirePermissions(principal: Principal | null, permissions: readonly Permission[]) {
  if (!principal) throw new AuthorizationError("UNAUTHENTICATED");
  for (const permission of permissions) requirePermission(principal, permission);
  return principal;
}

export function authorizeRequest(request: Request, permissions: readonly Permission[]) {
  try {
    const principal = requirePermissions(sessionFromRequest(request), permissions);
    return { ok: true as const, principal };
  } catch (error) {
    return {
      ok: false as const,
      response: authorizationErrorResponse(error)
    };
  }
}

export function requireResourceOwner(
  principal: Principal | null,
  resource: Resource,
  ownerId: string,
  selfAction: Action,
  elevatedAction?: Action
) {
  if (!principal) throw new AuthorizationError("UNAUTHENTICATED");
  requirePermission(principal, { resource, action: selfAction });
  if (principal.userId === ownerId) return principal;
  const crossOwnerActions: Partial<Record<Action, Action>> = {
    [Action.READ]: Action.READ_ANY,
    [Action.READ_SELF]: Action.READ_ANY,
    [Action.UPDATE]: Action.UPDATE_ANY,
    [Action.UPDATE_SELF]: Action.UPDATE_ANY,
    [Action.DELETE]: Action.DELETE_ANY
  };
  const crossOwnerAction = elevatedAction ?? crossOwnerActions[selfAction];
  if (!crossOwnerAction) throw new AuthorizationError("FORBIDDEN");
  return requirePermission(principal, { resource, action: crossOwnerAction });
}
