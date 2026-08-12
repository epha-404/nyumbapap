import { NextResponse } from "next/server";
import { z } from "zod";
import { Action, authorizeRequest, Resource } from "@/modules/auth/authorization";
import { enforceWriteRateLimit } from "@/modules/rate-limit/write-rate-limit";
import { locateKenyanAddress } from "@/modules/listings/location";

const querySchema = z.string().trim().min(3).max(200);

export async function GET(request: Request) {
  const authorization = authorizeRequest(request, [{ resource: Resource.LISTING, action: Action.CREATE }]);
  if (!authorization.ok) return authorization.response;
  const limited = await enforceWriteRateLimit(request, "geocoding:locate", authorization.principal.userId, 20);
  if (limited) return limited;
  const parsed = querySchema.safeParse(new URL(request.url).searchParams.get("q"));
  if (!parsed.success) return NextResponse.json({ error: "Enter a more specific Kenyan address" }, { status: 400 });
  try {
    const results = await locateKenyanAddress(parsed.data);
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ error: "Address lookup is temporarily unavailable" }, { status: 502 });
  }
}
