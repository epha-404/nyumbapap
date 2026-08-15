import { NextResponse } from "next/server";
import { z } from "zod";
import { AuthFlowError, verifyOtp } from "@/modules/auth/otp";
import { sessionFromRequest } from "@/modules/auth/request-session";
import { createSessionToken, SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from "@/modules/auth/session";
import { authCookieOptions, clientIpHash, deviceIdentity, isMobileRequest, verifyCsrfRequest } from "@/modules/auth/request-security";

const schema = z.object({ email: z.string().trim().email().max(254), code: z.string().regex(/^\d{6}$/) });

export async function POST(request: Request) {
  if (!verifyCsrfRequest(request)) return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  if (!sessionFromRequest(request)) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid email and six-digit code" }, { status: 400 });
  const device = deviceIdentity(request);
  try {
    const user = await verifyOtp({ ...parsed.data, deviceHash: device.hash, ipHash: clientIpHash(request) });
    const sessionToken = createSessionToken(user);
    const response = NextResponse.json({ ok: true, ...(isMobileRequest(request) ? { sessionToken } : {}) });
    if (!isMobileRequest(request)) response.cookies.set(SESSION_COOKIE, sessionToken, authCookieOptions(true, SESSION_MAX_AGE_SECONDS));
    return response;
  } catch (error) {
    return NextResponse.json({ error: error instanceof AuthFlowError ? error.message : "Verification failed" }, { status: error instanceof AuthFlowError ? error.status : 500 });
  }
}
