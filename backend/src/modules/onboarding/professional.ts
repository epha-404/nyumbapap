import { db } from "@/lib/db";
import type { Principal } from "@/modules/auth/authorization";
import { Role } from "@/modules/auth/roles";

export async function professionalOnboardingSubmitted(principal: Principal) {
  if (principal.role === Role.LANDLORD) {
    const profile = await db.landlordProfile.findUnique({
      where: { userId: principal.userId },
      select: { verificationState: true }
    });
    return Boolean(profile && ["UNVERIFIED", "PENDING", "APPROVED"].includes(profile.verificationState));
  }
  if (principal.role === Role.AGENT) {
    const profile = await db.agentProfile.findUnique({
      where: { userId: principal.userId },
      select: { verificationState: true }
    });
    return Boolean(profile && ["PENDING", "APPROVED"].includes(profile.verificationState));
  }
  return true;
}
