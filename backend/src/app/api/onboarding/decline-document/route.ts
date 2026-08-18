import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Action, authorizeRequest, Resource, Role } from "@/modules/auth/authorization";
import { clientIpHash, verifyCsrfRequest } from "@/modules/auth/request-security";
import { ensureAuditEventsImmutable } from "@/modules/verification/audit";

export async function POST(request: Request) {
  if (!verifyCsrfRequest(request)) return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  const authorization = authorizeRequest(request, [{ resource: Resource.ONBOARDING, action: Action.UPDATE_SELF }]);
  if (!authorization.ok) return authorization.response;
  if (authorization.principal.role !== Role.LANDLORD) return NextResponse.json({ error: "Only landlords can choose the unverified tier" }, { status: 403 });
  const userId = authorization.principal.userId;
  const profile = await db.landlordProfile.findUnique({ where: { userId }, select: { verificationState: true, identityNumberHash: true } });
  if (!profile?.identityNumberHash) return NextResponse.json({ error: "Save your professional details before choosing this option" }, { status: 409 });
  if (profile.verificationState === "APPROVED") return NextResponse.json({ error: "A verified profile cannot be changed to unverified through this option" }, { status: 409 });
  const pendingDocument = await db.verificationRecord.findFirst({ where: { subjectUserId: userId, kind: "LANDLORD_IDENTITY", state: "PENDING" }, select: { id: true } });
  if (pendingDocument) return NextResponse.json({ error: "Your identity document is already awaiting review" }, { status: 409 });
  if (profile.verificationState === "UNVERIFIED") return NextResponse.json({ onboarding: { role: Role.LANDLORD, name: authorization.principal.displayName ?? "", verificationState: "UNVERIFIED", hasCredential: true }, duplicate: true });
  await ensureAuditEventsImmutable();
  await db.$transaction(async tx => {
    await tx.landlordProfile.update({ where: { userId }, data: { verificationState: "UNVERIFIED" } });
    await tx.auditEvent.create({ data: {
      actorId: userId,
      action: "LANDLORD_IDENTITY_UPLOAD_DECLINED",
      entityType: "LandlordProfile",
      entityId: userId,
      requestId: request.headers.get("x-request-id"),
      ipHash: clientIpHash(request),
      metadata: { verificationTier: "UNVERIFIED" }
    } });
  });
  return NextResponse.json({ onboarding: { role: Role.LANDLORD, name: authorization.principal.displayName ?? "", verificationState: "UNVERIFIED", hasCredential: true }, duplicate: false });
}
