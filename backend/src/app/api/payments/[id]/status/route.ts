import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Action, authorizeRequest, Resource } from "@/modules/auth/authorization";
import { paymentUiState } from "@/modules/payments/status";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Context) {
  const authorization = authorizeRequest(request, [{ resource: Resource.PAYMENT, action: Action.READ }]);
  if (!authorization.ok) return authorization.response;
  const { id } = await params;
  const payment = await db.payment.findFirst({
    where: { id, userId: authorization.principal.userId },
    select: { id: true, listingId: true, state: true, resultCode: true, resultDescription: true, expiresAt: true, unlock: { select: { id: true } } }
  });
  if (!payment) return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  return NextResponse.json({ payment: { ...payment, uiState: paymentUiState(payment), unlocked: Boolean(payment.unlock) } });
}
