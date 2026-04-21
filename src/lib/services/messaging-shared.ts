// Prisma-free primitives shared between `taxonomy-loader.ts` (boot validator
// for messaging templates / starter packs) and `messaging-automation.service.ts`
// (runtime gates). Split out to avoid the loader → service cycle that would
// pull `@/lib/db` into boot.

export const SENSITIVE_PREARRIVAL_MAX_LEAD_HOURS = 48;
export const SENSITIVE_PREARRIVAL_MAX_LEAD_MINUTES =
  SENSITIVE_PREARRIVAL_MAX_LEAD_HOURS * 60;
export const SENSITIVE_PREARRIVAL_MAX_LEAD_MS =
  SENSITIVE_PREARRIVAL_MAX_LEAD_HOURS * 60 * 60 * 1000;

const TOKEN_REGEX = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;

export function extractVariableTokens(body: string): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const match of body.matchAll(TOKEN_REGEX)) {
    const token = match[1];
    if (!seen.has(token)) {
      seen.add(token);
      ordered.push(token);
    }
  }
  return ordered;
}

export const MESSAGE_TEMPLATE_ORIGINS = ["user", "pack"] as const;
export type MessageTemplateOrigin = (typeof MESSAGE_TEMPLATE_ORIGINS)[number];
