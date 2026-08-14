import { NextResponse } from "next/server";
import { z } from "zod";
import { AuthFlowError, requestEmailMigrationOtp } from "@/modules/auth/otp";
import { sessionFromRequest } from "@/modules/auth/request-session";
import { authCookieOptions, clientIpHash, deviceIdentity, DEVICE_COOKIE, verifyCsrfRequest } from "@/modules/auth/request-security";

const schema = z.object({ email: z.string().trim().email().max(254) });

export async function POST(request: Request) {
  if (!verifyCsrfRequest(request)) return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  const session = sessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  const device = deviceIdentity(request);
  try {
    const result = await requestEmailMigrationOtp({ ...parsed.data, userId: session.userId, deviceHash: device.hash, ipHash: clientIpHash(request) });
    const response = NextResponse.json(result);
    if (device.isNew) response.cookies.set(DEVICE_COOKIE, device.token, authCookieOptions(true, 365 * 86400));
    return response;
  } catch (error) {
    const status = error instanceof AuthFlowError ? error.status : 500;
    const response = NextResponse.json({ error: error instanceof Error ? error.message : "Could not send code" }, { status });
    if (error instanceof AuthFlowError && error.retryAfter) response.headers.set("Retry-After", String(error.retryAfter));
    return response;
  }
}
