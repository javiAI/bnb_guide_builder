/**
 * Strip keys with null or empty-string values from a record.
 * Used before serializing JSON to avoid persisting empty fields.
 */
export function stripNulls(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== null && v !== ""));
}
