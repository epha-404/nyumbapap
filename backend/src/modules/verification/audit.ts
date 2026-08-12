async function installAuditGuard() { /* Enforced by application RBAC; MongoDB validator is installed by db:setup. */ }

let auditGuardPromise: Promise<void> | null = null;

export function ensureAuditEventsImmutable() {
  auditGuardPromise ??= installAuditGuard().catch((error) => {
    auditGuardPromise = null;
    throw error;
  });
  return auditGuardPromise;
}
