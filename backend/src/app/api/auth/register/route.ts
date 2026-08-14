import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ error: "Password registration has been replaced by email OTP." }, { status: 410 });
}
