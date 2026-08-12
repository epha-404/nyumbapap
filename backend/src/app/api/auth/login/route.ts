import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ error: "Password sign-in has been replaced by phone OTP." }, { status: 410 });
}
