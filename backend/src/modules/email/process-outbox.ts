import { db } from "@/lib/db";
import { decryptField } from "@/lib/crypto";
import { sendNesEmail } from "./nes";
import { renderOutboxEmail } from "./templates";

export async function processEmailOutbox(limit = 25) {
  const messages = await db.notificationOutbox.findMany({ where: { status: { in: ["PENDING", "RETRY"] }, availableAt: { lte: new Date() } }, include: { recipient: { include: { account: true } } }, orderBy: { createdAt: "asc" }, take: limit });
  let sent = 0, skipped = 0, failed = 0;
  for (const message of messages) {
    const template = renderOutboxEmail(message.topic, message.payload, message.recipient.account?.displayName ?? "NyumbaPap user");
    if (!template || !message.recipient.emailVerifiedAt || (!message.recipient.email && !message.recipient.emailEncrypted)) {
      await db.notificationOutbox.update({ where: { id: message.id }, data: { status: "SKIPPED", processedAt: new Date(), lastError: template ? "Recipient has no verified email" : "No email template for topic" } });
      skipped++;
      continue;
    }
    try {
      const to = message.recipient.email ?? decryptField(Buffer.from(message.recipient.emailEncrypted!), process.env.FIELD_ENCRYPTION_KEY_BASE64!);
      await sendNesEmail({ ...template, to });
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
