import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { nesSignatureHash, verifyNesSignature } from "@/modules/email/webhook";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-nisoko-signature");
  const secret = process.env.NES_WEBHOOK_SECRET;
  if (!secret || !verifyNesSignature(rawBody, signature, secret)) return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  let payload: Record<string, unknown>;
  try { payload = JSON.parse(rawBody) as Record<string, unknown>; } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const eventType = String(payload.type ?? payload.event ?? payload.event_type ?? "unknown");
  if (!eventType.startsWith("email.")) return NextResponse.json({ error: "Unsupported event" }, { status: 400 });
  const message = payload.message && typeof payload.message === "object" ? payload.message as Record<string, unknown> : {};
  const messageId = String(payload.message_id ?? payload.messageId ?? message.id ?? "") || null;
  const candidate = payload.occurred_at ?? payload.timestamp;
  const occurredAt = candidate ? new Date(String(candidate)) : new Date();
  const signatureHash = nesSignatureHash(signature!);
  await db.emailDeliveryEvent.upsert({ where: { id: signatureHash }, create: { id: signatureHash, eventType, messageId, occurredAt: Number.isNaN(occurredAt.getTime()) ? new Date() : occurredAt, payload: payload as Prisma.InputJsonObject }, update: {} });
  return NextResponse.json({ ok: true });
}
