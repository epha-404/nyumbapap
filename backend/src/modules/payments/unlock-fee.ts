export const UNLOCK_FEE_CONFIG_ID = "default";

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
