import type { PrismaClient } from "@prisma/client";

export interface StkStatusProvider {
  queryStkStatus(checkoutRequestId: string): Promise<{ resultCode: number; resultDescription: string }>;
}

export async function reconcileExpiredStkPayments(db: PrismaClient, provider: StkStatusProvider, now = new Date()) {
  const payments = await db.payment.findMany({
    where: { state: { in: ["PENDING", "PROCESSING"] }, expiresAt: { lte: now }, checkoutRequestId: { not: null } },
    orderBy: { expiresAt: "asc" },
    take: 100
  });
  let paid = 0;
  let failed = 0;
  let deferred = 0;
  for (const payment of payments) {
    try {
      const result = await provider.queryStkStatus(payment.checkoutRequestId!);
      if (result.resultCode === 0) {
        await db.$transaction(async (tx) => {
          const updated = await tx.payment.updateMany({ where: { id: payment.id, state: { in: ["PENDING", "PROCESSING"] } }, data: { state: "PAID", resultCode: 0, resultDescription: result.resultDescription, paidAt: now, reconciledAt: now } });
          if (updated.count && payment.purpose === "TENANT_UNLOCK" && payment.listingId) await tx.tenantUnlock.upsert({ where: { tenantId_listingId: { tenantId: payment.userId, listingId: payment.listingId } }, create: { tenantId: payment.userId, listingId: payment.listingId, paymentId: payment.id }, update: {} });
        });
        paid++;
      } else {
        await db.payment.updateMany({ where: { id: payment.id, state: { in: ["PENDING", "PROCESSING"] } }, data: { state: result.resultCode === 1032 ? "CANCELLED" : "FAILED", resultCode: result.resultCode, resultDescription: result.resultDescription, reconciledAt: now } });
        failed++;
      }
    } catch {
      deferred++;
    }
  }
  return { checked: payments.length, paid, failed, deferred };
}
