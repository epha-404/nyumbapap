import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { listingImageStorage } from "@/modules/storage/listing-image-storage";

type Context = { params: Promise<{ id: string }> };
type Variant = { name: string; key: string; mimeType: string };

export async function GET(request: Request, { params }: Context) {
  const { id } = await params;
  const media = await db.listingMedia.findFirst({
    where: {
      id,
      moderationState: "APPROVED",
      listing: { status: "PUBLISHED" }
    },
    select: { storageKey: true, mimeType: true, variants: true }
  });
  if (!media) return NextResponse.json({ error: "Image not found" }, { status: 404 });

  const variantName = new URL(request.url).searchParams.get("variant");
  const variants = Array.isArray(media.variants) ? media.variants as Variant[] : [];
  const variant = variantName ? variants.find((item) => item.name === variantName) : undefined;
  if (variantName && !variant) return NextResponse.json({ error: "Image variant not found" }, { status: 404 });

  try {
    const object = await listingImageStorage().get(variant?.key ?? media.storageKey);
    return new NextResponse(Buffer.from(object.body), {
      headers: {
        "Content-Type": variant?.mimeType ?? object.contentType ?? media.mimeType,
        "Cache-Control": object.cacheControl ?? "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch {
    return NextResponse.json({ error: "Image unavailable" }, { status: 404 });
  }
}
