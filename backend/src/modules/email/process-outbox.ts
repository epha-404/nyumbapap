import { db } from "@/lib/db";
import { decryptField } from "@/lib/crypto";
import { sendNesEmail } from "./nes";
import { renderOutboxEmail } from "./templates";
import { activeAvailabilityChannel, type AvailabilityActionLink } from "@/modules/notifications/channels";

function availabilityPayload(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const payload = value as Record<string, unknown>;
  if (typeof payload.listingId !== "string" || typeof payload.listingTitle !== "string" || typeof payload.heading !== "string" || typeof payload.introduction !== "string" || !Array.isArray(payload.actions)) return null;
  const actions = payload.actions.filter((action): action is AvailabilityActionLink => Boolean(action && typeof action === "object" && typeof (action as Record<string, unknown>).label === "string" && typeof (action as Record<string, unknown>).url === "string"));
  return actions.length ? { listing: { id: payload.listingId, title: payload.listingTitle }, heading: payload.heading, introduction: payload.introduction, actions } : null;
}

export async function processEmailOutbox(limit = 25) {
  const messages = await db.notificationOutbox.findMany({ where: { status: { in: ["PENDING", "RETRY"] }, availableAt: { lte: new Date() } }, include: { recipient: { include: { account: true } } }, orderBy: { createdAt: "asc" }, take: limit });
  let sent = 0, skipped = 0, failed = 0;
  for (const message of messages) {
    const availability = ["TENANT_AVAILABILITY_CHECK", "LANDLORD_AVAILABILITY_CONFIRMATION"].includes(message.topic) ? availabilityPayload(message.payload) : null;
    const template = availability ? null : renderOutboxEmail(message.topic, message.payload, message.recipient.account?.displayName ?? "NyumbaPap user");
    if ((!template && !availability) || !message.recipient.emailVerifiedAt || (!message.recipient.email && !message.recipient.emailEncrypted)) {
      await db.notificationOutbox.update({ where: { id: message.id }, data: { status: "SKIPPED", processedAt: new Date(), lastError: template || availability ? "Recipient has no verified email" : "No email template for topic" } });
      skipped++;
      continue;
    }
    try {
      const to = message.recipient.email ?? decryptField(Buffer.from(message.recipient.emailEncrypted!), process.env.FIELD_ENCRYPTION_KEY_BASE64!);
      if (availability) await activeAvailabilityChannel().sendAvailabilityCheck({ recipient: { email: to }, ...availability });
      else await sendNesEmail({ ...template!, to });
      await db.notificationOutbox.update({ where: { id: message.id }, data: { status: "SENT", processedAt: new Date(), attempts: { increment: 1 }, lastError: null } });
      sent++;
    } catch (error) {
      const attempts = message.attempts + 1;
      await db.notificationOutbox.update({ where: { id: message.id }, data: { status: attempts >= 5 ? "DEAD" : "RETRY", attempts, availableAt: new Date(Date.now() + Math.min(3600, 2 ** attempts * 60) * 1000), lastError: error instanceof Error ? error.message.slice(0, 500) : "Email delivery failed" } });
      failed++;
    }
  }
  return { examined: messages.length, sent, skipped, failed };
}
