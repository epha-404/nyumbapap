import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { db } from "@/lib/db";
import { processDarajaCallback } from "@/modules/payments/process-callback";
import { darajaCallbackSchema } from "@/modules/payments/mpesa";

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  if (rawBody.length > 64_000) return NextResponse.json({ ResultCode: 1, ResultDesc: "Payload too large" }, { status: 413 });
  try {
    await processDarajaCallback(db, rawBody);
    const callback = darajaCallbackSchema.parse(JSON.parse(rawBody)).Body.stkCallback;
    await db.payment.updateMany({ where: { checkoutRequestId: callback.CheckoutRequestID }, data: { resultCode: callback.ResultCode, resultDescription: callback.ResultDesc } });
    return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
  }
  catch (error) { if (error instanceof ZodError || error instanceof SyntaxError) return NextResponse.json({ ResultCode: 1, ResultDesc: "Invalid callback" }, { status: 400 }); console.error("M-Pesa callback processing failed", { name: error instanceof Error ? error.name : "UnknownError" }); return NextResponse.json({ ResultCode: 1, ResultDesc: "Not accepted" }, { status: 400 }); }
}
