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
  // Dev-only: in production the deprecation in server logs is legitimate ops
  // signal. The AWS warning is one-shot, so restore the original right after
  // suppressing it — the monkey-patch doesn't outlive its purpose.
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NODE_ENV === "production") return;
  const original = process.emitWarning.bind(process);
  process.emitWarning = ((warning: string | Error, ...args: unknown[]) => {
    const text = typeof warning === "string" ? warning : (warning?.message ?? "");
    if (text.includes("AWS SDK for JavaScript (v3)")) {
      process.emitWarning = original;
      return;
    }
    return (original as (w: string | Error, ...rest: unknown[]) => void)(warning, ...args);
  }) as typeof process.emitWarning;
}
