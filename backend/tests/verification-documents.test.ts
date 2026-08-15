import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { DocumentValidationError, validateIdentityDocument } from "@/modules/verification/documents";

describe("identity document validation", () => {
  it("accepts inert PDFs and fully decodes/re-encodes JPEG and PNG images", async () => {
    expect((await validateIdentityDocument(Buffer.from("%PDF-1.7 inert document"), "application/pdf")).key).toMatch(/^verification-documents\/[0-9a-f-]+\.pdf$/);
    for (const format of ["jpeg", "png"] as const) {
      const source = await sharp({ create: { width: 20, height: 20, channels: 3, background: "white" } })[format]().toBuffer();
      const result = await validateIdentityDocument(source, `image/${format}`);
      expect(result.key).toMatch(/\.jpg$/);
      expect(result.mimeType).toBe("image/jpeg");
      expect((await sharp(result.body).metadata()).format).toBe("jpeg");
    }
  });

  it("rejects unsupported types, signature spoofing, malformed images, and active PDFs", async () => {
    await expect(validateIdentityDocument(Buffer.from("plain text"), "text/plain")).rejects.toBeInstanceOf(DocumentValidationError);
    await expect(validateIdentityDocument(Buffer.from("not a pdf"), "application/pdf")).rejects.toThrow("Document contents do not match its MIME type");
    await expect(validateIdentityDocument(Buffer.from([0xff, 0xd8, 0xff, 0x00]), "image/jpeg")).rejects.toThrow("Invalid or unsafe identity-document image");
    await expect(validateIdentityDocument(Buffer.from("%PDF-1.7 /OpenAction 1 0 R /JavaScript"), "application/pdf")).rejects.toThrow("active or embedded content");
  });
});
