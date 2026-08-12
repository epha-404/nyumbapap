import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { Action, authorizeRequest, Resource } from "@/modules/auth/authorization";
import { verifyCsrfRequest } from "@/modules/auth/request-security";
import { initiateTenantUnlock } from "@/modules/payments/initiate-payment";
import { DarajaHttpError, DarajaProvider } from "@/modules/payments/mpesa";
import { consumeRateLimit } from "@/modules/auth/request-security";
import { ensureAuditEventsImmutable } from "@/modules/verification/audit";

const inputSchema = z.object({
  listingId: z.string().min(1),
  phoneE164: z.string().regex(/^254[17]\d{8}$/, "Enter a valid Kenyan M-Pesa number")
});

export async function POST(request: Request) {
  if (!verifyCsrfRequest(request)) return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  const authorization = authorizeRequest(request, [{ resource: Resource.PAYMENT, action: Action.CREATE }]);
  if (!authorization.ok) return authorization.response;
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payment request" }, { status: 400 });
  const since = new Date(Date.now() - 3_600_000);
  const [userAttempts, listingAttempts, userListingAttempts] = await Promise.all([
    db.payment.count({ where: { userId: authorization.principal.userId, createdAt: { gte: since } } }),
    db.payment.count({ where: { listingId: parsed.data.listingId, createdAt: { gte: since } } }),
    db.payment.count({ where: { userId: authorization.principal.userId, listingId: parsed.data.listingId, createdAt: { gte: since } } })
  ]);
  const attempts = await Promise.all([
    consumeRateLimit("stk:user", authorization.principal.userId, 10, 3600),
    consumeRateLimit("stk:listing", parsed.data.listingId, 30, 3600),
    consumeRateLimit("stk:user-listing", `${authorization.principal.userId}:${parsed.data.listingId}`, 3, 3600)
  ]);
  const hit = attempts.find((attempt) => attempt.limited);
  if (hit || userAttempts >= 10 || listingAttempts >= 30 || userListingAttempts >= 3) {
    const retryAfter = hit?.retryAfter ?? 3600;
    await ensureAuditEventsImmutable();
    await db.auditEvent.create({ data: { actorId: authorization.principal.userId, action: "STK_RATE_LIMIT_HIT", entityType: "Listing", entityId: parsed.data.listingId, metadata: { retryAfterSeconds: retryAfter, userAttempts, listingAttempts, userListingAttempts, captchaHook: "stk-initiation", captchaRequired: false } } });
    return NextResponse.json({ error: `Too many payment attempts. Try again in ${Math.ceil(retryAfter / 60)} minutes.`, retryAfterSeconds: retryAfter, captchaRequired: false }, { status: 429, headers: { "Retry-After": String(retryAfter) } });
  }

  try {
    const payment = await initiateTenantUnlock(db, new DarajaProvider(), {
      userId: authorization.principal.userId,
      listingId: parsed.data.listingId,
      phoneE164: `+${parsed.data.phoneE164}`
    });
    return NextResponse.json({ payment }, { status: 202 });
  } catch (error) {
    if (error instanceof Error && error.message === "LISTING_NOT_FOUND") return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    if (error instanceof Error && error.message === "ALREADY_UNLOCKED") return NextResponse.json({ error: "Listing is already unlocked" }, { status: 409 });
    const networkFailure = error instanceof TypeError || (error instanceof Error && ["AbortError", "TimeoutError"].includes(error.name));
    const category = error instanceof DarajaHttpError
      ? error.category === "AUTH" ? "CREDENTIAL_OR_AUTH_FAILURE" : "DARAJA_HTTP_FAILURE"
      : networkFailure ? "NETWORK_OR_TIMEOUT_FAILURE" : "UNEXPECTED_FAILURE";
    console.error("M-Pesa STK initiation failed", {
      category,
      name: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      darajaStatus: error instanceof DarajaHttpError ? error.status : undefined,
      darajaResponseBody: error instanceof DarajaHttpError ? error.responseBody : undefined,
      cause: error instanceof Error && error.cause ? String(error.cause) : undefined,
      listingId: parsed.data.listingId,
      userId: authorization.principal.userId
    });
    return NextResponse.json({ error: "Could not start M-Pesa payment" }, { status: 502 });
  }
}
