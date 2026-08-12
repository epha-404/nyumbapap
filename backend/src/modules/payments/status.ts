export type PaymentUiState = "WAITING" | "PAID" | "CANCELLED" | "WRONG_PIN" | "INSUFFICIENT_FUNDS" | "TIMED_OUT" | "FAILED";

export function paymentUiState(payment: { state: string; resultCode: number | null; expiresAt: Date | null }, now = new Date()): PaymentUiState {
  if (payment.state === "PAID") return "PAID";
  if (payment.resultCode === 1032 || payment.state === "CANCELLED") return "CANCELLED";
  if (payment.resultCode === 2001) return "WRONG_PIN";
  if (payment.resultCode === 1) return "INSUFFICIENT_FUNDS";
  if (payment.resultCode === 1037 || (payment.expiresAt && payment.expiresAt <= now && ["PENDING", "PROCESSING"].includes(payment.state))) return "TIMED_OUT";
  if (payment.state === "FAILED") return "FAILED";
  return "WAITING";
}
