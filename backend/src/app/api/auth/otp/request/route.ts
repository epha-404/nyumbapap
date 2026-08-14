import { NextResponse } from "next/server";
import { z } from "zod";
import { requestOtp, AuthFlowError } from "@/modules/auth/otp";
import { authCookieOptions, clientIpHash, deviceIdentity, DEVICE_COOKIE, verifyCsrfRequest } from "@/modules/auth/request-security";
import { Role } from "@/modules/auth/roles";

const schema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("LOGIN"), email: z.string().trim().email().max(254) }),
  z.object({ mode: z.literal("REGISTER"), email: z.string().trim().email().max(254), displayName: z.string().trim().min(2).max(80), role: z.enum(["CLIENT", "LANDLORD", "AGENT"]) })
]);

export async function POST(request: Request) {
  if (!verifyCsrfRequest(request)) return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid details" }, { status: 400 });
  const device = deviceIdentity(request);
  try {
    const data = parsed.data.mode === "REGISTER"
      ? {
          ...parsed.data,
          role: (parsed.data.role === "CLIENT"
            ? Role.CLIENT
            : parsed.data.role === "AGENT"
              ? Role.AGENT
              : Role.LANDLORD) as Role.CLIENT | Role.LANDLORD | Role.AGENT
        }
      : parsed.data;
    const result = await requestOtp({ ...data, deviceHash: device.hash, ipHash: clientIpHash(request) });
    const response = NextResponse.json(result);
    if (device.isNew) response.cookies.set(DEVICE_COOKIE, device.token, authCookieOptions(true, 365 * 86400));
    return response;
  } catch (error) {
    const status = error instanceof AuthFlowError ? error.status : 500;
    const response = NextResponse.json({ error: error instanceof Error ? error.message : "Could not send code" }, { status });
    if (error instanceof AuthFlowError && error.retryAfter) response.headers.set("Retry-After", String(error.retryAfter));
    if (device.isNew) response.cookies.set(DEVICE_COOKIE, device.token, authCookieOptions(true, 365 * 86400));
    return response;
  }
}
