import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { badgeFor, VerificationKind } from "@/modules/verification/policy";
import { sessionFromRequest } from "@/modules/auth/request-session";
import { calculateUnlockFee, UNLOCK_FEE_CONFIG_ID } from "@/modules/payments/unlock-fee";
import { createHash } from "node:crypto";
import { clientIpHash } from "@/modules/auth/request-security";
import { landlordVerificationBadge } from "@/modules/listings/ranking";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Context) {
  const { id } = await params;
  const session = sessionFromRequest(request);
  const [listing, feeConfig, existingUnlock] = await Promise.all([db.listing.findFirst({
    where: { id, status: "PUBLISHED" },
    select: {
      id: true,
      title: true,
      description: true,
      verificationState: true,
      expiresAt: true,
      unit: {
        select: {
          unitType: true,
          bedrooms: true,
          bathrooms: true,
          sizeSquareMetres: true,
          monthlyRentKes: true,
          depositKes: true,
          amenities: true,
          property: {
            select: {
              county: true,
              town: true,
              approximateArea: true,
              approximateLatitude: true,
              approximateLongitude: true,
              owner: { select: { landlordProfile: { select: { verificationState: true } } } }
            }
          }
        }
      },
      media: {
        where: { moderationState: "APPROVED" },
        orderBy: { sortOrder: "asc" },
        select: { id: true, width: true, height: true }
      }
    }
  }), db.unlockFeeConfig.findUnique({ where: { id: UNLOCK_FEE_CONFIG_ID }, select: { rate: true, floorKes: true, ceilingKes: true } }),
    session ? db.tenantUnlock.findUnique({ where: { tenantId_listingId: { tenantId: session.userId, listingId: id } }, select: { payment: { select: { state: true } } } }) : Promise.resolve(null)
  ]);
  if (!listing) return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  if (!feeConfig) return NextResponse.json({ error: "Unlock fee configuration is unavailable" }, { status: 503 });
  const viewerKey = session ? `user:${session.userId}` : `device:${clientIpHash(request)}`;
  const viewerKeyHash = createHash("sha256").update(viewerKey).digest("hex");
  const now = new Date();
  const viewDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  await db.listingDailyView.upsert({
    where: { listingId_viewerKeyHash_viewDate: { listingId: id, viewerKeyHash, viewDate } },
    create: { listingId: id, viewerKeyHash, viewDate },
    update: {}
  });
  const { owner, ...publicProperty } = listing.unit.property;
  return NextResponse.json({
    listing: {
      ...listing,
      unit: { ...listing.unit, property: publicProperty },
      landlordBadge: landlordVerificationBadge(owner?.landlordProfile?.verificationState ?? null),
      unlockFeeKes: calculateUnlockFee(listing.unit.monthlyRentKes, { ...feeConfig, rate: Number(feeConfig.rate) }),
      hasPaidUnlock: existingUnlock?.payment.state === "PAID",
      signedIn: Boolean(session),
      badge: badgeFor(VerificationKind.LISTING, listing.verificationState, listing.expiresAt),
      images: listing.media.map((image) => ({
        id: image.id,
        url: `/api/listing-media/${image.id}`,
        width: image.width,
        height: image.height
      })),
      media: undefined
    }
  });
}
