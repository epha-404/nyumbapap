import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { blindIndex, encryptField } from "@/lib/crypto";
import { Action, authorizeRequest, Resource, Role } from "@/modules/auth/authorization";
import { verifyCsrfRequest } from "@/modules/auth/request-security";

const landlordSchema = z.object({
  displayName: z.string().trim().min(2).max(80),
  identityNumber: z.string().trim().min(5).max(40)
});

const agentSchema = z.object({
  agencyName: z.string().trim().min(2).max(120),
  licenceNumber: z.string().trim().min(3).max(80)
});

function secrets() {
  const encryptionKey = process.env.FIELD_ENCRYPTION_KEY_BASE64;
  const hashPepper = process.env.FIELD_HASH_PEPPER ?? process.env.SESSION_SECRET;
  if (!encryptionKey) throw new Error("FIELD_ENCRYPTION_KEY_BASE64 is required");
  if (!hashPepper) throw new Error("FIELD_HASH_PEPPER or SESSION_SECRET is required");
  return { encryptionKey, hashPepper };
}

export async function GET(request: Request) {
  const authorization = authorizeRequest(request, [{ resource: Resource.ONBOARDING, action: Action.READ_SELF }]);
  if (!authorization.ok) return authorization.response;
  const principal = authorization.principal;

  if (principal.role === Role.LANDLORD) {
    const profile = await db.landlordProfile.findUnique({
      where: { userId: principal.userId },
      select: { displayName: true, verificationState: true, identityNumberHash: true }
    });
    return NextResponse.json({
      onboarding: {
        role: principal.role,
        name: profile?.displayName ?? principal.displayName ?? "",
        verificationState: profile?.verificationState ?? "NOT_SUBMITTED",
        hasCredential: Boolean(profile?.identityNumberHash)
      }
    });
  }

  const profile = await db.agentProfile.findUnique({
    where: { userId: principal.userId },
    select: { agencyName: true, verificationState: true, licenceHash: true }
  });
  return NextResponse.json({
    onboarding: {
      role: principal.role,
      name: profile?.agencyName ?? principal.displayName ?? "",
      verificationState: profile?.verificationState ?? "NOT_SUBMITTED",
      hasCredential: Boolean(profile?.licenceHash)
    }
  });
}

export async function PUT(request: Request) {
  if (!verifyCsrfRequest(request)) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }
  const authorization = authorizeRequest(request, [{ resource: Resource.ONBOARDING, action: Action.UPDATE_SELF }]);
  if (!authorization.ok) return authorization.response;
  const principal = authorization.principal;
  const body = await request.json().catch(() => null);
  const { encryptionKey, hashPepper } = secrets();

  if (principal.role === Role.LANDLORD) {
    const parsed = landlordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid onboarding details" }, { status: 400 });
    }
    const { displayName, identityNumber } = parsed.data;
    await db.$transaction([
      db.landlordProfile.upsert({
        where: { userId: principal.userId },
        create: {
          userId: principal.userId,
          displayName,
          identityNumberEncrypted: encryptField(identityNumber, encryptionKey),
          identityNumberHash: blindIndex(identityNumber, hashPepper),
          verificationState: "PENDING"
        },
        update: {
          displayName,
          identityNumberEncrypted: encryptField(identityNumber, encryptionKey),
          identityNumberHash: blindIndex(identityNumber, hashPepper),
          verificationState: "PENDING"
        }
      }),
      db.appAccount.update({ where: { id: principal.userId }, data: { displayName } })
    ]);
  } else {
    const parsed = agentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid onboarding details" }, { status: 400 });
    }
    const { agencyName, licenceNumber } = parsed.data;
    await db.$transaction([
      db.agentProfile.upsert({
        where: { userId: principal.userId },
        create: {
          userId: principal.userId,
          agencyName,
          licenceEncrypted: encryptField(licenceNumber, encryptionKey),
          licenceHash: blindIndex(licenceNumber, hashPepper),
          verificationState: "PENDING"
        },
        update: {
          agencyName,
          licenceEncrypted: encryptField(licenceNumber, encryptionKey),
          licenceHash: blindIndex(licenceNumber, hashPepper),
          verificationState: "PENDING"
        }
      }),
      db.appAccount.update({ where: { id: principal.userId }, data: { displayName: agencyName } })
    ]);
  }

  return NextResponse.json({ ok: true, verificationState: "PENDING" });
}
