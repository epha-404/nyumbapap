import { sendNesEmail } from "@/modules/email/nes";

export type AvailabilityActionLink = { label: string; url: string };
export type AvailabilityCheckMessage = {
  recipient: { email?: string; phoneE164?: string };
  listing: { id: string; title: string };
  heading: string;
  introduction: string;
  actions: AvailabilityActionLink[];
};

export interface NotificationChannel {
  readonly type: "EMAIL" | "SMS";
  sendAvailabilityCheck(message: AvailabilityCheckMessage): Promise<{ providerMessageId: string }>;
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);

export class EmailNotificationChannel implements NotificationChannel {
  readonly type = "EMAIL" as const;
  async sendAvailabilityCheck(message: AvailabilityCheckMessage) {
    if (!message.recipient.email) throw new Error("Availability email recipient is missing");
    const actionText = message.actions.map(action => `${action.label}: ${action.url}`).join("\n");
    const actionHtml = message.actions.map(action => `<p><a href="${escapeHtml(action.url)}" style="display:inline-block;padding:12px 18px;background:#17352f;color:#fff;text-decoration:none;border-radius:8px">${escapeHtml(action.label)}</a></p>`).join("");
    const result = await sendNesEmail({
      to: message.recipient.email,
      category: "operations",
      subject: message.heading,
      text: `${message.introduction}\n\n${message.listing.title}\n\n${actionText}\n\nThese links are time-bound and can only be used once.`,
      html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#17352f"><h2>${escapeHtml(message.heading)}</h2><p>${escapeHtml(message.introduction)}</p><p><strong>${escapeHtml(message.listing.title)}</strong></p>${actionHtml}<p>These links are time-bound and can only be used once.</p></div>`
    });
    const id = result.id ?? result.message_id ?? result.messageId;
    return { providerMessageId: typeof id === "string" ? id : "accepted" };
  }
}

export class SmsNotificationChannel implements NotificationChannel {
  readonly type = "SMS" as const;
  async sendAvailabilityCheck(message: AvailabilityCheckMessage) {
    const apiKey = process.env.AFRICASTALKING_API_KEY;
    const username = process.env.AFRICASTALKING_USERNAME;
    if (!apiKey || !username || !message.recipient.phoneE164) throw new Error("Africa's Talking availability SMS is not configured");
    const body = new URLSearchParams({
      username,
      to: message.recipient.phoneE164,
      message: `${message.introduction} ${message.listing.title}. ${message.actions.map(action => `${action.label}: ${action.url}`).join(" ")}`,
      ...(process.env.AFRICASTALKING_SENDER_ID ? { from: process.env.AFRICASTALKING_SENDER_ID } : {})
    });
    const response = await fetch("https://api.africastalking.com/version1/messaging", { method: "POST", headers: { apiKey, Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" }, body });
    if (!response.ok) throw new Error(`SMS provider rejected availability message (${response.status})`);
    const result = await response.json() as { SMSMessageData?: { Recipients?: Array<{ messageId?: string }> } };
    return { providerMessageId: result.SMSMessageData?.Recipients?.[0]?.messageId ?? "accepted" };
  }
}

export function configuredNotificationChannels(dependencies: { email?: () => NotificationChannel; sms?: () => NotificationChannel } = {}) {
  const channels: NotificationChannel[] = [(dependencies.email ?? (() => new EmailNotificationChannel()))()];
  if (process.env.AFRICASTALKING_API_KEY?.trim()) channels.push((dependencies.sms ?? (() => new SmsNotificationChannel()))());
  return channels;
}

export function activeAvailabilityChannel(dependencies?: Parameters<typeof configuredNotificationChannels>[0]) {
  return configuredNotificationChannels(dependencies).find(channel => channel.type === "EMAIL")!;
}
