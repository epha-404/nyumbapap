import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Action, authorizeRequest, Resource } from "@/modules/auth/authorization";
import { listingImageStorage } from "@/modules/storage/listing-image-storage";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Context) {
  const authorization = authorizeRequest(request, [{ resource: Resource.LISTING, action: Action.READ_ANY }]);
  if (!authorization.ok) return authorization.response;
  const { id } = await params;
  const media = await db.listingMedia.findUnique({ where: { id }, select: { storageKey: true } });
  if (!media) return NextResponse.json({ error: "Photo not found" }, { status: 404 });
  try {
    const object = await listingImageStorage().get(media.storageKey);
    return new NextResponse(Buffer.from(object.body), {
      headers: { "content-type": object.contentType, "cache-control": "private, no-store", "x-content-type-options": "nosniff" }
    });
  } catch {
    return NextResponse.json({ error: "Photo could not be loaded" }, { status: 404 });
  }
}
