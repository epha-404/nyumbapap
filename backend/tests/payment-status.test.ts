import { describe, expect, it } from "vitest";
import { paymentUiState } from "@/modules/payments/status";

const future = new Date("2026-01-01T00:02:00Z");
const now = new Date("2026-01-01T00:00:00Z");
describe("payment UI status", () => {
  it.each([[1032, "CANCELLED"], [2001, "WRONG_PIN"], [1, "INSUFFICIENT_FUNDS"], [1037, "TIMED_OUT"]] as const)("maps Daraja code %s", (resultCode, expected) => {
    expect(paymentUiState({ state: "FAILED", resultCode, expiresAt: future }, now)).toBe(expected);
  });
  it("distinguishes waiting, paid, and locally expired payments", () => {
    expect(paymentUiState({ state: "PROCESSING", resultCode: null, expiresAt: future }, now)).toBe("WAITING");
    expect(paymentUiState({ state: "PAID", resultCode: 0, expiresAt: future }, now)).toBe("PAID");
    expect(paymentUiState({ state: "PROCESSING", resultCode: null, expiresAt: new Date(0) }, now)).toBe("TIMED_OUT");
  });
});
