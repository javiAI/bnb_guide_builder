import { requireOperator, type OperatorContext } from "@/lib/auth/require-operator";
import { applyOperatorRateLimit } from "@/lib/services/operator-rate-limit";
import {
  checkPlacesRateLimit,
  enforcePlacesBucketCap,
} from "@/lib/services/places/rate-limit";
import {
  PoiProviderConfigError,
  PoiProviderUnavailableError,
} from "@/lib/services/places";
export { clampDiscoveryRadius } from "@/lib/services/arrival-discovery.service";

/** Resolve the operator + apply the `expensive` per-actor bucket. Tagged
 * result so the action can early-return without nested try/catch. */
export async function authorizeDiscoveryActor(): Promise<
  { ok: true; operator: OperatorContext } | { ok: false; error: string }
> {
  return authorizeBucket("expensive");
}

/** Resolve the operator + apply the `mutate` per-actor bucket. Same shape as
 * `authorizeDiscoveryActor`, separate helper so each call site documents the
 * bucket it pays into without a magic-string argument. */
export async function requireOperatorMutate(): Promise<
  { ok: true; operator: OperatorContext } | { ok: false; error: string }
> {
  return authorizeBucket("mutate");
}

async function authorizeBucket(
  bucket: "expensive" | "mutate",
): Promise<{ ok: true; operator: OperatorContext } | { ok: false; error: string }> {
  let operator: OperatorContext;
  try {
    operator = await requireOperator();
  } catch {
    return { ok: false, error: "Sesión requerida" };
  }
  const gate = applyOperatorRateLimit({ userId: operator.userId, bucket });
  if (!gate.ok) {
    return {
      ok: false,
      error: `Demasiadas peticiones. Reintenta en ${gate.retryAfterSeconds}s.`,
    };
  }
  return { ok: true, operator };
}

/** Per-property limiter on top of the actor bucket — guards against
 * coordinated bursts targeting the same property across actors. */
export function authorizeDiscoveryProperty(
  gateKey: string,
): { ok: true } | { ok: false; error: string } {
  const now = Date.now();
  const gate = checkPlacesRateLimit(gateKey, now);
  enforcePlacesBucketCap(now);
  if (!gate.allowed) {
    return {
      ok: false,
      error: `Demasiadas peticiones. Reintenta en ${gate.retryAfterSeconds}s.`,
    };
  }
  return { ok: true };
}

/** Map a provider exception to a user-facing string + log the technical
 * details with the action's tag. Generic catch returns a stable "unexpected"
 * message so caller error UIs don't leak internals. */
export function mapDiscoveryError(
  err: unknown,
  logTag: string,
  logCtx?: Record<string, string>,
): string {
  const ctxStr = logCtx
    ? " " + Object.entries(logCtx).map(([k, v]) => `${k}=${v}`).join(" ")
    : "";
  if (err instanceof PoiProviderConfigError) {
    return "Proveedor de mapas no configurado";
  }
  if (err instanceof PoiProviderUnavailableError) {
    console.error(`${logTag}${ctxStr} provider unavailable:`, err.message);
    return "Proveedor de mapas no disponible";
  }
  console.error(`${logTag}${ctxStr} error:`, err);
  return "Error inesperado";
}

/** Materialize the set of already-confirmed providerPlaceIds for a property
 * (drops null IDs from manual rows). Reused by both discovery actions to
 * tell the service which suggestions are already on the map. */
export function collectExcludeProviderPlaceIds(
  rows: ReadonlyArray<{ providerPlaceId: string | null }>,
): ReadonlySet<string> {
  return new Set(
    rows
      .map((r) => r.providerPlaceId)
      .filter((id): id is string => id !== null),
  );
}
