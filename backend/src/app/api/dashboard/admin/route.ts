import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureAccountsTable } from "@/modules/auth/accounts";
import { Action, authorizeRequest, Resource } from "@/modules/auth/authorization";
import { roleFromStoredValue, Role } from "@/modules/auth/roles";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authorization = authorizeRequest(request, [
    { resource: Resource.USER, action: Action.READ },
    { resource: Resource.LISTING, action: Action.READ },
    { resource: Resource.PAYMENT, action: Action.READ },
    { resource: Resource.LANDLORD_FINANCE, action: Action.READ }
  ]);
  if (!authorization.ok) return authorization.response;

  await ensureAccountsTable();
  const [users, listings, properties, payments] = await Promise.all([
    db.user.findMany({ include: { account: true }, orderBy: { createdAt: "desc" } }),
    db.listing.findMany({ include: { unit: { include: { property: true } } }, orderBy: { createdAt: "desc" } }),
    db.property.count(),
    db.payment.findMany({ select: { amountKes: true, state: true, purpose: true } })
  ]);

  const mappedUsers = users.map((user) => ({ ...user, applicationRole: roleFromStoredValue(user.role) }));
  const revenue = payments.filter((payment) => payment.state === "PAID").reduce((sum, payment) => sum + payment.amountKes, 0);
  return NextResponse.json({
    displayName: authorization.principal.displayName,
    stats: {
      users: users.length,
      landlords: mappedUsers.filter((user) => user.applicationRole === Role.LANDLORD).length,
      clients: mappedUsers.filter((user) => user.applicationRole === Role.CLIENT).length,
      properties,
      listings: listings.length,
      revenue
    },
    users: mappedUsers.map((user) => ({
      id: user.id,
      role: user.applicationRole ?? "UNKNOWN",
      status: user.status,
      createdAt: user.createdAt.toISOString(),
      displayName: user.account?.displayName ?? null
    })),
    listings: listings.map((listing) => ({
      id: listing.id,
      title: listing.title,
      status: listing.status,
      area: listing.unit.property.approximateArea,
      town: listing.unit.property.town,
      monthlyRentKes: listing.unit.monthlyRentKes
    }))
  });
}
