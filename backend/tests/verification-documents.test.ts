import { describe, expect, it } from "vitest";
import { DocumentValidationError, validateIdentityDocument } from "@/modules/verification/documents";

describe("identity document validation", () => {
  it("accepts matching PDF, JPEG, and PNG signatures and creates private UUID keys", () => {
    expect(validateIdentityDocument(Buffer.from("%PDF-1.7 test"), "application/pdf").key).toMatch(/^verification-documents\/[0-9a-f-]+\.pdf$/);
    expect(validateIdentityDocument(Buffer.from([0xff, 0xd8, 0xff, 0x00]), "image/jpeg").key).toMatch(/\.jpg$/);
    expect(validateIdentityDocument(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]), "image/png").key).toMatch(/\.png$/);
  });
  it("rejects unsupported MIME types and signature spoofing", () => {
    expect(() => validateIdentityDocument(Buffer.from("plain text"), "text/plain")).toThrow(DocumentValidationError);
    expect(() => validateIdentityDocument(Buffer.from("not a pdf"), "application/pdf")).toThrow("Document contents do not match its MIME type");
  });
});
