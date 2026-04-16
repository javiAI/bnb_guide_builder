/**
 * Strip keys with null or empty-string values from a record.
 * Used before serializing JSON to avoid persisting empty fields.
 */
export function stripNulls(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== null && v !== ""));
}

/** Prisma P2002 = unique constraint violation. */
export function isPrismaUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "P2002"
  );
}
