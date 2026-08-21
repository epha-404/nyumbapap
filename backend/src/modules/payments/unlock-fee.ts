import type { PrismaClient } from "@prisma/client";

export const UNLOCK_FEE_CONFIG_ID = "default";
export const DEFAULT_UNLOCK_FEE_CONFIG = { rate: 0.025, floorKes: 100, ceilingKes: 800 } as const;

export type UnlockFeeParameters = {
  rate: number;
  floorKes: number;
  ceilingKes: number;
};

export function calculateUnlockFee(monthlyRentKes: number, config: UnlockFeeParameters) {
  if (!Number.isInteger(monthlyRentKes) || monthlyRentKes < 0) throw new Error("INVALID_MONTHLY_RENT");
  if (!Number.isFinite(config.rate) || config.rate <= 0 || !Number.isInteger(config.floorKes) || !Number.isInteger(config.ceilingKes) || config.floorKes <= 0 || config.ceilingKes < config.floorKes) {
    throw new Error("INVALID_UNLOCK_FEE_CONFIG");
  }
  const roundedToNearestTen = Math.round((monthlyRentKes * config.rate) / 10) * 10;
  return Math.min(config.ceilingKes, Math.max(config.floorKes, roundedToNearestTen));
}

type UnlockFeeDatabase = Pick<PrismaClient, "unlockFeeConfig">;

export async function getOrCreateUnlockFeeConfig(database: UnlockFeeDatabase) {
  const select = { rate: true, floorKes: true, ceilingKes: true, updatedAt: true } as const;
  const existing = await database.unlockFeeConfig.findUnique({ where: { id: UNLOCK_FEE_CONFIG_ID }, select });
  if (existing) return existing;
  return database.unlockFeeConfig.upsert({
    where: { id: UNLOCK_FEE_CONFIG_ID },
    create: { id: UNLOCK_FEE_CONFIG_ID, ...DEFAULT_UNLOCK_FEE_CONFIG },
    update: {},
    select
  });
}
