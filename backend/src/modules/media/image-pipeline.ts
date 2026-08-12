import { randomUUID } from "node:crypto";
import sharp, { type Metadata } from "sharp";

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
export class ImageValidationError extends Error {}
export type ProcessedImage = { key: string; body: Buffer; mimeType: "image/webp"; width: number; height: number; sizeBytes: number; variants: Array<{ name: string; key: string; body: Buffer; mimeType: "image/webp" | "image/avif"; width: number; height: number; sizeBytes: number }> };

export async function processListingImage(input: Buffer, declaredMime: string, options?: Partial<{ maxBytes: number; maxPixels: number; maxDimension: number; webpQuality: number; avifQuality: number }>): Promise<ProcessedImage> {
  const config = { maxBytes: Number(process.env.IMAGE_MAX_UPLOAD_BYTES ?? 12_582_912), maxPixels: Number(process.env.IMAGE_MAX_INPUT_PIXELS ?? 40_000_000), maxDimension: Number(process.env.IMAGE_MAX_DIMENSION ?? 1920), webpQuality: Number(process.env.IMAGE_WEBP_QUALITY ?? 78), avifQuality: Number(process.env.IMAGE_AVIF_QUALITY ?? 55), ...options };
  if (!ALLOWED_MIME.has(declaredMime.toLowerCase())) throw new ImageValidationError("Unsupported image MIME type");
  if (!input.length || input.length > config.maxBytes) throw new ImageValidationError("Image exceeds upload size limit");
  let metadata: Metadata;
  try { metadata = await sharp(input, { failOn: "error", limitInputPixels: config.maxPixels }).metadata(); }
  catch { throw new ImageValidationError("Invalid or unsafe image contents"); }
  if (!metadata.format || !["jpeg", "png", "webp", "avif"].includes(metadata.format)) throw new ImageValidationError("File contents are not a supported image");
  if (!metadata.width || !metadata.height || metadata.width * metadata.height > config.maxPixels) throw new ImageValidationError("Image dimensions exceed safety limit");
  const baseKey = `listings/${randomUUID()}`;
  // rotate() applies EXIF orientation; rebuilding as WebP strips EXIF, GPS, ICC and other source metadata.
  const primaryBody = await sharp(input, { failOn: "error", limitInputPixels: config.maxPixels }).rotate().resize({ width: config.maxDimension, height: config.maxDimension, fit: "inside", withoutEnlargement: true }).webp({ quality: config.webpQuality }).toBuffer();
  const primaryMeta = await sharp(primaryBody).metadata();
  const variants: ProcessedImage["variants"] = [];
  for (const width of [480, 960]) {
    if ((primaryMeta.width ?? 0) <= width) continue;
    for (const format of ["webp", "avif"] as const) {
      const pipeline = sharp(primaryBody).resize({ width, withoutEnlargement: true });
      const body = format === "avif" ? await pipeline.avif({ quality: config.avifQuality }).toBuffer() : await pipeline.webp({ quality: config.webpQuality }).toBuffer();
      const info = await sharp(body).metadata();
      variants.push({ name: `${width}w-${format}`, key: `${baseKey}-${width}.${format}`, body, mimeType: `image/${format}`, width: info.width!, height: info.height!, sizeBytes: body.length });
    }
  }
  return { key: `${baseKey}.webp`, body: primaryBody, mimeType: "image/webp", width: primaryMeta.width!, height: primaryMeta.height!, sizeBytes: primaryBody.length, variants };
}
