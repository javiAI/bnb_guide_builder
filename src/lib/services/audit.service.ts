import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";

export const AUDIT_ACTIONS = {
  create: "create",
  update: "update",
  delete: "delete",
  publish: "publish",
  unpublish: "unpublish",
  rollback: "rollback",
  sessionStart: "session.start",
  sessionEnd: "session.end",
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

const AUDIT_ACTION_VALUES = new Set<string>(Object.values(AUDIT_ACTIONS));

export function assertAuditAction(action: string): asserts action is AuditAction {
  if (!AUDIT_ACTION_VALUES.has(action)) {
    throw new Error(
      `Unknown audit action "${action}". Add it to AUDIT_ACTIONS or use one of: ${[...AUDIT_ACTION_VALUES].join(", ")}.`,
    );
  }
}

export type ActorInput =
  | { type: "user"; userId: string }
  | { type: "guest"; slug: string }
  | { type: "system"; job: string };

export function formatActor(input: ActorInput): string {
  if (input.type === "user") return `user:${input.userId}`;
  if (input.type === "guest") return `guest:${input.slug}`;
  return `system:${input.job}`;
}

const SECRET_KEY_PATTERNS: ReadonlyArray<RegExp> = [
  /access[_-]?code/i,
  /access[_-]?token/i,
  /password/i,
  /secret/i,
  /api[_-]?key/i,
  /authorization/i,
  /smart[_-]?lock[_-]?(code|key|credential)/i,
  /key[_-]?location/i,
  /hidden[_-]?key/i,
  /^x-amz-/i,
];

const SECRET_VALUE_PATTERNS: ReadonlyArray<RegExp> = [
  /r2\.cloudflarestorage\.com/i,
  /[?&]X-Amz-/i,
];

const REDACTED = "[REDACTED]" as const;
const MAX_REDACT_DEPTH = 8;

export function redactSecretsForAudit(input: unknown): unknown {
  return redactInner(input, 0, new WeakSet());
}

function redactInner(value: unknown, depth: number, seen: WeakSet<object>): unknown {
  if (depth > MAX_REDACT_DEPTH) return REDACTED;
  if (value == null) return value;
  if (typeof value === "string") {
    if (SECRET_VALUE_PATTERNS.some((p) => p.test(value))) return REDACTED;
    return value;
  }
  if (typeof value !== "object") return value;
  if (seen.has(value as object)) return REDACTED;
  seen.add(value as object);

  if (Array.isArray(value)) {
    return value.map((v) => redactInner(v, depth + 1, seen));
  }

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (SECRET_KEY_PATTERNS.some((p) => p.test(k))) {
      out[k] = REDACTED;
      continue;
    }
    out[k] = redactInner(v, depth + 1, seen);
  }
  return out;
}

export interface WriteAuditInput {
  /**
   * Property scope of the audit. `null` for property-agnostic events
   * (session.start / session.end). Schema requires nullable column —
   * see migration `20260426*_audit_log_property_optional`.
   */
  propertyId: string | null;
  actor: string;
  entityType: string;
  entityId: string;
  action: AuditAction | string;
  diff?: unknown;
}

/**
 * Append an audit log row. Fail-soft: errors are logged and swallowed —
 * an audit failure must never propagate to the caller's response path.
 */
export async function writeAudit(input: WriteAuditInput): Promise<void> {
  try {
    assertAuditAction(input.action);
    const data: Prisma.AuditLogUncheckedCreateInput = {
      propertyId: input.propertyId,
      actor: input.actor,
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      diffJson:
        input.diff === undefined
          ? Prisma.JsonNull
          : (redactSecretsForAudit(input.diff) as Prisma.InputJsonValue),
    };
    await prisma.auditLog.create({ data });
  } catch (err) {
    console.error(
      `[audit] write failed for ${input.entityType}/${input.entityId} ${input.action}:`,
      err,
    );
  }
}
