import type { PrismaClient } from "@prisma/client";
import type { MobileMoneyProvider } from "./mpesa";
import { calculateUnlockFee, UNLOCK_FEE_CONFIG_ID } from "./unlock-fee";

type PaymentDatabase = Pick<PrismaClient, "listing" | "payment" | "tenantUnlock" | "unlockFeeConfig">;

export async function initiateTenantUnlock(
  db: PaymentDatabase,
  provider: MobileMoneyProvider,
  input: { userId: string; listingId: string; phoneE164: string }
) {
  const [listing, existingUnlock, feeConfig] = await Promise.all([
    db.listing.findFirst({ where: { id: input.listingId, status: "PUBLISHED" }, select: { id: true, unit: { select: { monthlyRentKes: true } } } }),
    db.tenantUnlock.findUnique({ where: { tenantId_listingId: { tenantId: input.userId, listingId: input.listingId } }, select: { id: true } }),
    db.unlockFeeConfig.findUnique({ where: { id: UNLOCK_FEE_CONFIG_ID }, select: { rate: true, floorKes: true, ceilingKes: true } })
  ]);
  if (!listing) throw new Error("LISTING_NOT_FOUND");
  if (existingUnlock) throw new Error("ALREADY_UNLOCKED");
  if (!feeConfig) throw new Error("UNLOCK_FEE_CONFIG_NOT_FOUND");
  const amountKes = calculateUnlockFee(listing.unit.monthlyRentKes, { ...feeConfig, rate: Number(feeConfig.rate) });

  const payment = await db.payment.create({
    data: {
      userId: input.userId,
      listingId: input.listingId,
      purpose: "TENANT_UNLOCK",
      amountKes,
      state: "PENDING",
      expiresAt: new Date(Date.now() + 90_000)
    },
    select: { id: true }
  });

  try {
    const request = await provider.requestStkPush({
      phoneE164: input.phoneE164,
      amountKes,
      accountReference: payment.id,
      description: "NyumbaPap listing unlock"
    });
    return await db.payment.update({
      where: { id: payment.id },
      data: {
        state: "PROCESSING",
        merchantRequestId: request.merchantRequestId,
        checkoutRequestId: request.checkoutRequestId
      },
      select: { id: true, state: true, checkoutRequestId: true }
    });
  } catch (error) {
    await db.payment.update({ where: { id: payment.id }, data: { state: "FAILED" } });
    throw error;
  }
}
