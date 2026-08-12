import { describe, expect, it } from "vitest";
import { calculateUnlockFee } from "@/modules/payments/unlock-fee";

const config = { rate: 0.025, floorKes: 100, ceilingKes: 800 };

describe("rent-based unlock fee", () => {
  it("applies the floor to low rents", () => {
    expect(calculateUnlockFee(3_000, config)).toBe(100);
  });

  it("rounds 2.5 percent of rent to the nearest KES 10", () => {
    expect(calculateUnlockFee(10_200, config)).toBe(260);
    expect(calculateUnlockFee(10_000, config)).toBe(250);
  });

  it("caps high rents at the ceiling", () => {
    expect(calculateUnlockFee(52_000, config)).toBe(800);
  });

  it("rejects invalid rent and configuration values", () => {
    expect(() => calculateUnlockFee(-1, config)).toThrow("INVALID_MONTHLY_RENT");
    expect(() => calculateUnlockFee(10_000, { ...config, ceilingKes: 50 })).toThrow("INVALID_UNLOCK_FEE_CONFIG");
  });
});
