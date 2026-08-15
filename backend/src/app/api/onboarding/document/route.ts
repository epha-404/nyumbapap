import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Action, authorizeRequest, Resource, Role } from "@/modules/auth/authorization";
import { clientIpHash, verifyCsrfRequest } from "@/modules/auth/request-security";
import { S3PrivateStorage } from "@/modules/storage/s3-storage";
import type { PrivateObjectStorage } from "@/modules/storage/provider";
import { ensureAuditEventsImmutable } from "@/modules/verification/audit";
import { DocumentValidationError, protectDocumentStorageKey, validateIdentityDocument } from "@/modules/verification/documents";
import { VerificationKind } from "@/modules/verification/policy";

export async function POST(request: Request) {
  if (!verifyCsrfRequest(request)) return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  const authorization = authorizeRequest(request, [{ resource: Resource.IDENTITY, action: Action.CREATE }]);
  if (!authorization.ok) return authorization.response;
  const principal = authorization.principal;
  if (principal.role !== Role.LANDLORD && principal.role !== Role.AGENT) {
    return NextResponse.json({ error: "Only landlords and agents can submit professional documents" }, { status: 403 });
  }

  const maxBytes = Number(process.env.IDENTITY_DOCUMENT_MAX_BYTES ?? 10_485_760);
  if (Number(request.headers.get("content-length") ?? 0) > maxBytes + 500_000) {
    return NextResponse.json({ error: "Upload request is too large" }, { status: 413 });
  }
  const form = await request.formData().catch(() => null);
  const document = form?.get("document");
  if (!(document instanceof File)) return NextResponse.json({ error: "Choose a document" }, { status: 400 });
  if (document.size > maxBytes) return NextResponse.json({ error: "Document exceeds upload size limit" }, { status: 413 });

  const kind = principal.role === Role.LANDLORD ? VerificationKind.LANDLORD_IDENTITY : VerificationKind.AGENT_LICENSE;
  const profile = principal.role === Role.LANDLORD
    ? await db.landlordProfile.findUnique({ where: { userId: principal.userId }, select: { identityNumberHash: true } })
    : await db.agentProfile.findUnique({ where: { userId: principal.userId }, select: { licenceHash: true } });
  const hasCredential = profile && ("identityNumberHash" in profile ? profile.identityNumberHash : profile.licenceHash);
  if (!hasCredential) return NextResponse.json({ error: "Save your onboarding details before uploading a document" }, { status: 409 });
  const existing = await db.verificationRecord.findFirst({
    where: { subjectUserId: principal.userId, kind, state: "PENDING" },
    select: { id: true }
  });
  if (existing) return NextResponse.json({ error: "A document is already awaiting review" }, { status: 409 });

  let prepared: Awaited<ReturnType<typeof validateIdentityDocument>>;
  let bytes: Buffer;
  try {
    bytes = Buffer.from(await document.arrayBuffer());
    prepared = await validateIdentityDocument(bytes, document.type);
  } catch (error) {
    if (error instanceof DocumentValidationError) return NextResponse.json({ error: error.message }, { status: 400 });
    throw error;
  }

  let storage: PrivateObjectStorage;
  try {
    storage = S3PrivateStorage.fromEnvironment();
    await storage.put({ key: prepared.key, body: prepared.body, contentType: prepared.mimeType, cacheControl: "private, no-store" });
  } catch (error) {
    console.error("Identity document storage failed", { name: error instanceof Error ? error.name : "UnknownError", message: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Private document storage is temporarily unavailable. Please retry." }, { status: 503, headers: { "Retry-After": "10" } });
  }
  try {
    await ensureAuditEventsImmutable();
    const record = await db.$transaction(async (tx) => {
      const created = await tx.verificationRecord.create({
        data: {
          subjectUserId: principal.userId,
          kind,
          state: "PENDING",
          documentStorageKeyEncrypted: protectDocumentStorageKey(prepared.key),
          documentHash: prepared.hash
        }
      });
      if (principal.role === Role.LANDLORD) {
        await tx.landlordProfile.update({ where: { userId: principal.userId }, data: { verificationState: "PENDING" } });
      } else {
        await tx.agentProfile.update({ where: { userId: principal.userId }, data: { verificationState: "PENDING" } });
      }
      await tx.auditEvent.create({
        data: {
          actorId: principal.userId,
          action: kind === VerificationKind.LANDLORD_IDENTITY ? "LANDLORD_IDENTITY_SUBMITTED" : "AGENT_LICENSE_SUBMITTED",
          entityType: "VerificationRecord",
          entityId: created.id,
          requestId: request.headers.get("x-request-id"),
          ipHash: clientIpHash(request),
          metadata: { kind, documentHash: prepared.hash }
        }
      });
      return created;
    });
    return NextResponse.json({ id: record.id, state: record.state, message: "Document submitted for verification" }, { status: 201 });
  } catch (error) {
    await storage.delete(prepared.key).catch(() => undefined);
    console.error("Identity document submission failed", { name: error instanceof Error ? error.name : "UnknownError" });
    return NextResponse.json({ error: "Could not submit document" }, { status: 500 });
  }
}
