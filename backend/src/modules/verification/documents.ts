import { createHash, randomUUID } from "node:crypto";
import sharp from "sharp";
import { decryptField, encryptField } from "@/lib/crypto";

const DOCUMENT_MIME = new Set(["application/pdf", "image/jpeg", "image/png"]);
const DANGEROUS_PDF_TOKENS = ["/javascript", "/js", "/openaction", "/aa", "/launch", "/embeddedfile"];
export class DocumentValidationError extends Error {}

function encryptionKey() {
  const key = process.env.FIELD_ENCRYPTION_KEY_BASE64;
  if (!key) throw new Error("FIELD_ENCRYPTION_KEY_BASE64 is required");
  return key;
}

export async function validateIdentityDocument(bytes: Buffer, mimeType: string) {
  if (!DOCUMENT_MIME.has(mimeType)) throw new DocumentValidationError("Upload a PDF, JPEG, or PNG document");
  const maxBytes = Number(process.env.IDENTITY_DOCUMENT_MAX_BYTES ?? 10_485_760);
  if (!bytes.length || bytes.length > maxBytes) throw new DocumentValidationError("Document exceeds upload size limit");

  let protectedBody: Buffer;
  let protectedMimeType: "application/pdf" | "image/jpeg";
  let extension: "pdf" | "jpg";
  if (mimeType === "application/pdf") {
    if (bytes.subarray(0, 5).toString("ascii") !== "%PDF-") throw new DocumentValidationError("Document contents do not match its MIME type");
    const searchable = bytes.toString("latin1").toLowerCase();
    if (DANGEROUS_PDF_TOKENS.some(token => searchable.includes(token))) throw new DocumentValidationError("PDF contains active or embedded content");
    protectedBody = bytes;
    protectedMimeType = "application/pdf";
    extension = "pdf";
  } else {
    try {
      const maxPixels = Number(process.env.IDENTITY_DOCUMENT_MAX_PIXELS ?? 25_000_000);
      const metadata = await sharp(bytes, { failOn: "error", limitInputPixels: maxPixels }).metadata();
      if (!metadata.format || !["jpeg", "png"].includes(metadata.format) || !metadata.width || !metadata.height || metadata.width * metadata.height > maxPixels) throw new Error("invalid image");
      const quality = Math.min(95, Math.max(60, Number(process.env.IDENTITY_DOCUMENT_IMAGE_QUALITY ?? 82)));
      protectedBody = await sharp(bytes, { failOn: "error", limitInputPixels: maxPixels })
        .rotate()
        .resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality, progressive: true, mozjpeg: true })
        .toBuffer();
      if (protectedBody.length > maxBytes) throw new DocumentValidationError("Processed document exceeds upload size limit");
      protectedMimeType = "image/jpeg";
      extension = "jpg";
    } catch (error) {
      if (error instanceof DocumentValidationError) throw error;
      throw new DocumentValidationError("Invalid or unsafe identity-document image");
    }
  }
  return { key: `verification-documents/${randomUUID()}.${extension}`, hash: createHash("sha256").update(protectedBody).digest("hex"), body: protectedBody, mimeType: protectedMimeType };
}

export function protectDocumentStorageKey(key: string) { return encryptField(key, encryptionKey()); }
export function revealDocumentStorageKey(value: Buffer) { return decryptField(value, encryptionKey()); }
export function protectVerificationNotes(notes: string) { return encryptField(notes, encryptionKey()); }
