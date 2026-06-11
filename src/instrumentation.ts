/**
 * Server-start hooks (Next.js instrumentation).
 *
 * AWS SDK v3 emits a one-shot NodeDeprecationWarning ("no longer support
 * Node.js v18 ... January 2026") the first time the R2/S3 client loads —
 * i.e. on any action that touches media. Next dev forwards server console
 * output to the browser overlay, so every space edit surfaced it as a scary
 * "Console Error". The warning is known and tracked (Node 20 upgrade is
 * FUTURE.md §19) — silence exactly that message until the upgrade lands.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const original = process.emitWarning.bind(process);
  process.emitWarning = ((warning: string | Error, ...args: unknown[]) => {
    const text = typeof warning === "string" ? warning : (warning?.message ?? "");
    if (text.includes("AWS SDK for JavaScript (v3)")) return;
    return (original as (w: string | Error, ...rest: unknown[]) => void)(warning, ...args);
  }) as typeof process.emitWarning;
}
