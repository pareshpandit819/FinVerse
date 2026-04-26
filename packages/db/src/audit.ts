import type { Prisma, PrismaClient } from "@prisma/client";

export type AuditAction =
  | "plaid_item.created"
  | "plaid_item.deleted"
  | "plaid_item.relink_required"
  | "membership.created"
  | "membership.updated"
  | "membership.removed"
  | "goal.created"
  | "goal.updated"
  | "goal.deleted"
  | "budget.created"
  | "budget.updated"
  | "budget.deleted"
  | "mfa.enrolled"
  | "mfa.disabled"
  | "insight.feedback";

const REDACTED = "[REDACTED]";
const SENSITIVE_FIELDS = new Set(["encryptedAccessToken", "encryptedSecret", "sessionToken"]);

function redactSensitive(obj: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!obj) return null;
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k, SENSITIVE_FIELDS.has(k) ? REDACTED : v])
  );
}

export interface WriteAuditParams {
  tx: Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;
  userId: string | null;
  organizationId: string | null;
  action: AuditAction;
  entityType: string;
  entityId?: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  ipAddress?: string;
}

/**
 * Writes an immutable audit log entry within the caller's transaction.
 * Must be called inside a $transaction block so the audit record is
 * committed atomically with the business operation it records.
 */
export async function writeAudit(params: WriteAuditParams): Promise<void> {
  await params.tx.$executeRaw`
    INSERT INTO audit_logs
      (id, user_id, organization_id, action, entity_type, entity_id, before, after, ip_address, created_at)
    VALUES (
      gen_random_uuid(),
      ${params.userId ?? null}::uuid,
      ${params.organizationId ?? null}::uuid,
      ${params.action},
      ${params.entityType},
      ${params.entityId ?? null}::uuid,
      ${params.before ? (JSON.stringify(redactSensitive(params.before)) as unknown as Prisma.InputJsonValue) : Prisma.DbNull},
      ${params.after ? (JSON.stringify(redactSensitive(params.after)) as unknown as Prisma.InputJsonValue) : Prisma.DbNull},
      ${params.ipAddress ?? null},
      NOW()
    )
  `;
}
