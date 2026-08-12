import { NextResponse } from "next/server";
import { Action, authorizeRequest, Resource } from "@/modules/auth/authorization";
import { db } from "@/lib/db";
import { decryptField } from "@/lib/crypto";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authorization = authorizeRequest(request, [{ resource: Resource.SESSION, action: Action.READ }]);
  if (!authorization.ok) return authorization.response;
  const user = await db.user.findUnique({ where: { id: authorization.principal.userId }, select: { phoneEncrypted: true } });
  let phone: string | null = null;
  if (user?.phoneEncrypted && process.env.FIELD_ENCRYPTION_KEY_BASE64) {
    try { phone = decryptField(user.phoneEncrypted, process.env.FIELD_ENCRYPTION_KEY_BASE64); } catch {}
  }
  return NextResponse.json({ session: { ...authorization.principal, phone } });
}
