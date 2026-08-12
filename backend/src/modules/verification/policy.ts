export enum VerificationKind {
  LANDLORD_IDENTITY = "LANDLORD_IDENTITY",
  AGENT_LICENSE = "AGENT_LICENSE",
  LISTING_PHOTO = "LISTING_PHOTO",
  LISTING = "LISTING"
}

export type BadgeDefinition = Readonly<{
  label: string;
  validDays: number;
  expiringSoonDays: number;
}>;

export const BADGE_DEFINITIONS: Readonly<Record<VerificationKind, BadgeDefinition>> = {
  [VerificationKind.LANDLORD_IDENTITY]: {
    label: "Verified landlord",
    validDays: 365,
    expiringSoonDays: 30
  },
  [VerificationKind.AGENT_LICENSE]: {
    label: "Verified agent",
    validDays: 365,
    expiringSoonDays: 30
  },
  [VerificationKind.LISTING_PHOTO]: {
    label: "Verified interior photo",
    validDays: 90,
    expiringSoonDays: 14
  },
  [VerificationKind.LISTING]: {
    label: "Verified listing",
    validDays: 90,
    expiringSoonDays: 14
  }
};

export function verificationExpiresAt(kind: VerificationKind, reviewedAt = new Date()) {
  return new Date(reviewedAt.getTime() + BADGE_DEFINITIONS[kind].validDays * 86_400_000);
}

export function badgeFor(
  kind: VerificationKind,
  state: string,
  expiresAt: Date | string | null | undefined,
  now = new Date()
) {
  const definition = BADGE_DEFINITIONS[kind];
  const expiry = expiresAt ? new Date(expiresAt) : null;
  if (state !== "APPROVED") return { ...definition, state: state.toLowerCase(), expiresAt: expiry?.toISOString() ?? null };
  if (!expiry || expiry.getTime() <= now.getTime()) {
    return { ...definition, state: "expired", expiresAt: expiry?.toISOString() ?? null };
  }
  const expiringSoon = expiry.getTime() - now.getTime() <= definition.expiringSoonDays * 86_400_000;
  return {
    ...definition,
    state: expiringSoon ? "expiring" : "verified",
    expiresAt: expiry.toISOString()
  };
}
