import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

type Json = Prisma.InputJsonValue;

export type AuditEvent = {
  entityType: string;
  entityId: string;
  action: string;
  actorId: string;
  before?: Json | null;
  after?: Json | null;
  metadata?: Json | null;
  /**
   * Pass a Prisma transaction client when the audit row must commit/rollback
   * with the same transaction as the business write — required for status
   * changes, GR posting, and any multi-row update.
   */
  tx?: Prisma.TransactionClient;
};

export async function writeAudit(event: AuditEvent) {
  const client = event.tx ?? prisma;
  return client.auditLog.create({
    data: {
      entityType: event.entityType,
      entityId: event.entityId,
      action: event.action,
      actorId: event.actorId,
      beforeState: event.before ?? undefined,
      afterState: event.after ?? undefined,
      metadata: event.metadata ?? undefined,
    },
  });
}
