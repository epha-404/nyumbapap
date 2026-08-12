import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { Action, authorizeRequest, Resource } from "@/modules/auth/authorization";
import { clientIpHash, verifyCsrfRequest } from "@/modules/auth/request-security";
import { ensureAuditEventsImmutable } from "@/modules/verification/audit";
import { protectVerificationNotes } from "@/modules/verification/documents";
import { badgeFor, verificationExpiresAt, VerificationKind } from "@/modules/verification/policy";

type Context = { params: Promise<{ id: string }> };
const decisionSchema = z.object({ decision: z.enum(["APPROVE", "REJECT"]), notes: z.string().trim().max(1000).optional().default("") });

export async function PATCH(request: Request, { params }: Context) {
  if (!verifyCsrfRequest(request)) return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  const authorization = authorizeRequest(request, [{ resource: Resource.IDENTITY, action: Action.MODERATE }]);
  if (!authorization.ok) return authorization.response;
  const parsed = decisionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid decision" }, { status: 400 });
  const { id } = await params;
  const record = await db.verificationRecord.findUnique({
    where: { id }, select: { id: true, subjectUserId: true, kind: true, state: true, subject: { select: { role: true } } }
  });
  if (!record) return NextResponse.json({ error: "Verification request not found" }, { status: 404 });
  if (record.state !== "PENDING") return NextResponse.json({ error: "This request has already been reviewed" }, { status: 409 });
  if (record.kind !== VerificationKind.LANDLORD_IDENTITY && record.kind !== VerificationKind.AGENT_LICENSE) {
    return NextResponse.json({ error: "Unsupported verification kind" }, { status: 400 });
  }
  const approved = parsed.data.decision === "APPROVE";
  const state = approved ? "APPROVED" : "REJECTED";
  const reviewedAt = new Date();
  const expiresAt = approved ? verificationExpiresAt(record.kind as VerificationKind, reviewedAt) : null;
  const notesEncrypted = parsed.data.notes ? protectVerificationNotes(parsed.data.notes) : null;
  await ensureAuditEventsImmutable();
  try {
    await db.$transaction(async (tx) => {
      const claimed = await tx.verificationRecord.updateMany({
        where: { id, state: "PENDING" },
        data: { state, reviewerId: authorization.principal.userId, reviewedAt, expiresAt, notesEncrypted }
      });
      if (claimed.count !== 1) throw new Error("DECISION_CONFLICT");
      if (record.kind === VerificationKind.LANDLORD_IDENTITY) {
        await tx.landlordProfile.update({ where: { userId: record.subjectUserId }, data: { verificationState: state } });
      } else {
        await tx.agentProfile.update({ where: { userId: record.subjectUserId }, data: { verificationState: state } });
      }
      await tx.auditEvent.create({
        data: {
          actorId: authorization.principal.userId,
          action: `${record.kind}_${approved ? "APPROVED" : "REJECTED"}`,
          entityType: "VerificationRecord",
          entityId: id,
          requestId: request.headers.get("x-request-id"),
          ipHash: clientIpHash(request),
          metadata: { kind: record.kind, decision: parsed.data.decision, expiresAt: expiresAt?.toISOString() ?? null }
        }
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "DECISION_CONFLICT") {
      return NextResponse.json({ error: "This request was reviewed by another verifier" }, { status: 409 });
    }
    throw error;
  }
  return NextResponse.json({ id, state, badge: badgeFor(record.kind as VerificationKind, state, expiresAt) });
}
