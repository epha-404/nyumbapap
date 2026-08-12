import { createHash, randomUUID } from "node:crypto";
import { decryptField, encryptField } from "@/lib/crypto";

const DOCUMENT_MIME_EXTENSIONS = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png"
} as const;

export class DocumentValidationError extends Error {}

function encryptionKey() {
  const key = process.env.FIELD_ENCRYPTION_KEY_BASE64;
  if (!key) throw new Error("FIELD_ENCRYPTION_KEY_BASE64 is required");
  return key;
}

export function validateIdentityDocument(bytes: Buffer, mimeType: string) {
  const extension = DOCUMENT_MIME_EXTENSIONS[mimeType as keyof typeof DOCUMENT_MIME_EXTENSIONS];
  if (!extension) throw new DocumentValidationError("Upload a PDF, JPEG, or PNG document");
  const maxBytes = Number(process.env.IDENTITY_DOCUMENT_MAX_BYTES ?? 10_485_760);
  if (!bytes.length || bytes.length > maxBytes) throw new DocumentValidationError("Document exceeds upload size limit");
  const validContents =
    (mimeType === "application/pdf" && bytes.subarray(0, 5).toString("ascii") === "%PDF-")
    || (mimeType === "image/jpeg" && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    || (mimeType === "image/png" && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])));
  if (!validContents) throw new DocumentValidationError("Document contents do not match its MIME type");
  return {
    key: `verification-documents/${randomUUID()}.${extension}`,
    hash: createHash("sha256").update(bytes).digest("hex")
  };
}

export function protectDocumentStorageKey(key: string) {
  return encryptField(key, encryptionKey());
}

export function revealDocumentStorageKey(value: Buffer) {
  return decryptField(value, encryptionKey());
}

export function protectVerificationNotes(notes: string) {
  return encryptField(notes, encryptionKey());
}
