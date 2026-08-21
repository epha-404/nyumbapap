import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Action, authorizeRequest, Resource } from "@/modules/auth/authorization";
import { NisokoObjectStorage } from "@/modules/storage/nisoko-storage";
import { revealDocumentStorageKey } from "@/modules/verification/documents";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Context) {
  const authorization = authorizeRequest(request, [{ resource: Resource.IDENTITY, action: Action.READ }]);
  if (!authorization.ok) return authorization.response;
  const { id } = await params;
  const record = await db.verificationRecord.findUnique({ where: { id }, select: { documentStorageKeyEncrypted: true } });
  if (!record?.documentStorageKeyEncrypted) return NextResponse.json({ error: "Document not found" }, { status: 404 });
  try {
    const object = await NisokoObjectStorage.privateDocumentsFromEnvironment().get(revealDocumentStorageKey(record.documentStorageKeyEncrypted));
    return new NextResponse(Buffer.from(object.body), {
      headers: {
        "content-type": object.contentType,
        "content-disposition": "attachment; filename=identity-document",
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
        "content-security-policy": "default-src 'none'; sandbox"
      }
    });
  } catch (error) {
    console.error("Identity document retrieval failed", {
      recordId: id,
      name: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : String(error)
    });
    return NextResponse.json({ error: "Document could not be loaded" }, { status: 404 });
  }
}
