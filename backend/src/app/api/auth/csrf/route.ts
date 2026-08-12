import { NextResponse } from "next/server";
import { authCookieOptions, createCsrfToken, CSRF_COOKIE } from "@/modules/auth/request-security";

export const dynamic = "force-dynamic";

export async function GET() {
  const token = createCsrfToken();
  const response = NextResponse.json({ token });
  response.cookies.set(CSRF_COOKIE, token, authCookieOptions(false, 60 * 60));
  return response;
}
