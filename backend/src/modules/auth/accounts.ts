import { createHash } from "crypto";
import { db } from "@/lib/db";

export type AccountRow = { id: string; displayName: string; passwordHash: string | null };

export function normalizePhone(input: string) {
  const digits = input.replace(/\D/g, "");
  if (digits.startsWith("254") && digits.length === 12) return `+${digits}`;
  if (digits.startsWith("0") && digits.length === 10) return `+254${digits.slice(1)}`;
  throw new Error("Enter a valid Kenyan phone number");
}

export const hashPhone = (phone: string) => createHash("sha256").update(normalizePhone(phone)).digest("hex");

async function createAuthTables() { await db.authRateLimit.findFirst({ select: { id: true } }); }

let authTablesPromise: Promise<void> | null = null;

export function ensureAuthTables() {
  authTablesPromise ??= createAuthTables().catch((error) => {
    authTablesPromise = null;
    throw error;
  });
  return authTablesPromise;
}

export const ensureAccountsTable = ensureAuthTables;
