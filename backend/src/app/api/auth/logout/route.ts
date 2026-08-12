import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/modules/auth/session";
import { authCookieOptions, verifyCsrfRequest } from "@/modules/auth/request-security";

export async function POST(request: Request) {
  if (!verifyCsrfRequest(request)) return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", { ...authCookieOptions(true, 0), expires: new Date(0) });
  return response;
}
