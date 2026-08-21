import { apiMultipart } from "./api";
import { createNativeFileFormData, type NativePickedFile } from "./native-multipart";

export async function uploadInteriorImages(listingId: string, files: readonly NativePickedFile[], onProgress?: (completed: number, total: number) => void) {
  const uploaded = [];
  for (const [index, file] of files.entries()) {
    const response = await apiMultipart(`dashboard/listings/${listingId}/images`, createNativeFileFormData("images", [file]));
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.retryable ? "Media storage is temporarily unavailable. Your photos remain on your device; retry in a moment." : result.error ?? "Could not upload image");
    if (Array.isArray(result.images)) uploaded.push(...result.images);
    onProgress?.(index + 1, files.length);
  }
  return uploaded;
}
