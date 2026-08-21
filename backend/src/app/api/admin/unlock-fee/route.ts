import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { Action, authorizeRequest, Resource } from "@/modules/auth/authorization";
import { verifyCsrfRequest } from "@/modules/auth/request-security";
import { enforceWriteRateLimit } from "@/modules/rate-limit/write-rate-limit";
import { getOrCreateUnlockFeeConfig, UNLOCK_FEE_CONFIG_ID } from "@/modules/payments/unlock-fee";

const inputSchema = z.object({
  rate: z.number().positive().max(1),
  floorKes: z.number().int().positive(),
  ceilingKes: z.number().int().positive()
}).refine((value) => value.ceilingKes >= value.floorKes, {
  message: "Ceiling must be greater than or equal to the floor",
  path: ["ceilingKes"]
});

const permission = [{ resource: Resource.PAYMENT, action: Action.UPDATE }] as const;

function response(config: { rate: unknown; floorKes: number; ceilingKes: number; updatedAt: Date }) {
  return {
    rate: Number(config.rate),
    floorKes: config.floorKes,
    ceilingKes: config.ceilingKes,
    updatedAt: config.updatedAt.toISOString()
  };
}

export async function GET(request: Request) {
  const authorization = authorizeRequest(request, permission);
  if (!authorization.ok) return authorization.response;
  const config = await getOrCreateUnlockFeeConfig(db);
  return NextResponse.json({ config: response(config) });
}

export async function PUT(request: Request) {
  if (!verifyCsrfRequest(request)) return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  const authorization = authorizeRequest(request, permission);
  if (!authorization.ok) return authorization.response;
  const limited = await enforceWriteRateLimit(request, "admin-unlock-fee:update", authorization.principal.userId, 20);
  if (limited) return limited;
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid fee configuration" }, { status: 400 });
  const config = await db.unlockFeeConfig.upsert({
    where: { id: UNLOCK_FEE_CONFIG_ID },
    create: { id: UNLOCK_FEE_CONFIG_ID, ...parsed.data },
    update: parsed.data
  });
  return NextResponse.json({ config: response(config) });
}
