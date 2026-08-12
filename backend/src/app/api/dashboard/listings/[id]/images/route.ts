import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  Action,
  AuthorizationError,
  authorizationErrorResponse,
  authorizeRequest,
  requireResourceOwner,
  Resource
} from "@/modules/auth/authorization";
import { clientIpHash, verifyCsrfRequest } from "@/modules/auth/request-security";
import { ImageValidationError } from "@/modules/media/image-pipeline";
import { saveListingImage } from "@/modules/media/save-listing-image";
import { S3PrivateStorage } from "@/modules/storage/s3-storage";

type Context = { params: Promise<{ id: string }> };
const MAX_LISTING_IMAGES = 12;
const MAX_IMAGES_PER_REQUEST = 6;

export async function POST(request: Request, { params }: Context) {
  if (!verifyCsrfRequest(request)) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }
  const authorization = authorizeRequest(request, [{ resource: Resource.LISTING, action: Action.UPDATE }]);
  if (!authorization.ok) return authorization.response;
  const { id } = await params;
  const listing = await db.listing.findUnique({
    where: { id },
    select: { unit: { select: { property: { select: { ownerId: true } } } } }
  });
  if (!listing) return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  try {
    requireResourceOwner(authorization.principal, Resource.LISTING, listing.unit.property.ownerId, Action.UPDATE);
  } catch (error) {
    return authorizationErrorResponse(error);
  }

  const maxImageBytes = Number(process.env.IMAGE_MAX_UPLOAD_BYTES ?? 12_582_912);
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > maxImageBytes * MAX_IMAGES_PER_REQUEST + 1_000_000) {
    return NextResponse.json({ error: "Upload request is too large" }, { status: 413 });
  }
  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Invalid multipart form data" }, { status: 400 });
  const images = form.getAll("images").filter((value): value is File => value instanceof File);
  if (!images.length) return NextResponse.json({ error: "Choose at least one image" }, { status: 400 });
  if (images.length > MAX_IMAGES_PER_REQUEST) {
    return NextResponse.json({ error: `Upload at most ${MAX_IMAGES_PER_REQUEST} images at once` }, { status: 400 });
  }
  if (images.some((image) => image.size > maxImageBytes)) {
    return NextResponse.json({ error: "Image exceeds upload size limit" }, { status: 413 });
  }
  const existingCount = await db.listingMedia.count({ where: { listingId: id } });
  if (existingCount + images.length > MAX_LISTING_IMAGES) {
    return NextResponse.json({ error: `A listing can contain at most ${MAX_LISTING_IMAGES} images` }, { status: 409 });
  }

  const saved = [];
  try {
    const storage = S3PrivateStorage.fromEnvironment();
    for (const [index, image] of images.entries()) {
      const media = await saveListingImage(
        { db, storage },
        {
          listingId: id,
          principal: authorization.principal,
          bytes: Buffer.from(await image.arrayBuffer()),
          mimeType: image.type,
          sortOrder: existingCount + index,
          requestId: request.headers.get("x-request-id"),
          ipHash: clientIpHash(request)
        }
      );
      saved.push({
        id: media.id,
        url: `/api/listing-media/${media.id}`,
        width: media.width,
        height: media.height,
        moderationState: media.moderationState
      });
    }
  } catch (error) {
    if (error instanceof ImageValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof Error && error.message === "LISTING_NOT_FOUND") {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }
    if (error instanceof AuthorizationError) return authorizationErrorResponse(error);
    console.error("Listing image upload failed", { name: error instanceof Error ? error.name : "UnknownError" });
    return NextResponse.json({ error: "Could not store listing images" }, { status: 500 });
  }
  return NextResponse.json({ images: saved, message: "Images uploaded and awaiting verification" }, { status: 201 });
}
