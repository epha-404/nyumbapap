import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { ImageValidationError, processListingImage } from "@/modules/media/image-pipeline";
describe("listing image pipeline", () => {
  it("rejects an allowed MIME with invalid contents", async () => await expect(processListingImage(Buffer.from("not an image"), "image/jpeg")).rejects.toBeInstanceOf(ImageValidationError));
  it("rejects oversized compressed input before decoding", async () => await expect(processListingImage(Buffer.alloc(11), "image/png", { maxBytes: 10 })).rejects.toThrow("size limit"));
  it("auto-bounds, strips metadata and emits WebP", async () => { const input = await sharp({ create: { width: 2400, height: 1200, channels: 3, background: "#075b49" } }).jpeg().withMetadata({ exif: { IFD0: { Copyright: "private" } } }).toBuffer(); const output = await processListingImage(input, "image/jpeg", { maxDimension: 1920, maxPixels: 4_000_000 }); const meta = await sharp(output.body).metadata(); expect(output.mimeType).toBe("image/webp"); expect(output.width).toBe(1920); expect(output.height).toBe(960); expect(meta.exif).toBeUndefined(); expect(output.key).toMatch(/^listings\/[0-9a-f-]+\.webp$/); }, 15_000);
  it("does not enlarge small images", async () => { const input = await sharp({ create: { width: 100, height: 80, channels: 3, background: "white" } }).png().toBuffer(); const output = await processListingImage(input, "image/png"); expect(output.width).toBe(100); expect(output.height).toBe(80); });
});
