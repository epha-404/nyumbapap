import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ error: "Password sign-in has been replaced by email OTP." }, { status: 410 });
}
