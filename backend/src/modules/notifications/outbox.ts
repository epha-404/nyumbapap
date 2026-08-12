import type { Prisma } from "@prisma/client";

export function outboxMessage(input: { recipientId: string; topic: string; dedupeKey: string; payload: Prisma.InputJsonObject }) {
  return {
    recipientId: input.recipientId,
    topic: input.topic,
    dedupeKey: input.dedupeKey,
    payload: input.payload
  };
}
