import { createHash } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { callbackValue, darajaCallbackSchema } from "./mpesa";

export async function processDarajaCallback(db: PrismaClient, rawBody: string) {
  const parsed = darajaCallbackSchema.parse(JSON.parse(rawBody)); const callback = parsed.Body.stkCallback; const callbackHash = createHash("sha256").update(rawBody).digest("hex");
  return db.$transaction(async tx => {
    const payment = await tx.payment.findFirst({ where: { checkoutRequestId: callback.CheckoutRequestID } });
    if (!payment || payment.merchantRequestId !== callback.MerchantRequestID) throw new Error("UNKNOWN_PAYMENT");
    if (payment.state === "PAID") return { paymentId: payment.id, state: "PAID" as const, duplicate: true };
    if (callback.ResultCode !== 0) { await tx.payment.update({ where: { id: payment.id }, data: { state: "FAILED", callbackHash } }); return { paymentId: payment.id, state: "FAILED" as const, duplicate: false }; }
    const receipt = String(callbackValue(parsed, "MpesaReceiptNumber") ?? ""); const amount = Number(callbackValue(parsed, "Amount"));
    if (!receipt || amount !== payment.amountKes) throw new Error("INVALID_PAYMENT_CONFIRMATION");
    await tx.payment.update({ where: { id: payment.id }, data: { state: "PAID", providerReceipt: receipt, callbackHash, paidAt: new Date() } });
    if (payment.purpose === "TENANT_UNLOCK") { if (!payment.listingId) throw new Error("PAYMENT_LISTING_REQUIRED"); await tx.tenantUnlock.upsert({ where: { tenantId_listingId: { tenantId: payment.userId, listingId: payment.listingId } }, create: { tenantId: payment.userId, listingId: payment.listingId, paymentId: payment.id }, update: {} }); }
    await tx.notificationOutbox.upsert({ where: { dedupeKey: `payment-receipt:${payment.id}` }, create: { recipientId: payment.userId, topic: "PAYMENT_RECEIPT", dedupeKey: `payment-receipt:${payment.id}`, payload: { paymentId: payment.id, listingId: payment.listingId, amountKes: payment.amountKes, receipt } }, update: {} });
    return { paymentId: payment.id, state: "PAID" as const, duplicate: false };
  });
}
