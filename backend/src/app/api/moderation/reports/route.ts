import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Action, authorizeRequest, Resource } from "@/modules/auth/authorization";

export async function GET(request: Request) {
  const authorization = authorizeRequest(request, [{ resource: Resource.LISTING, action: Action.READ_ANY }]);
  if (!authorization.ok) return authorization.response;
  const reports = await db.report.findMany({
    where: { status: { in: ["OPEN", "REVIEWING"] } },
    orderBy: { createdAt: "asc" },
    select: { id: true, listingId: true, reason: true, details: true, status: true, createdAt: true, listing: { select: { title: true, status: true } } }
  });
  return NextResponse.json({ reports });
}
