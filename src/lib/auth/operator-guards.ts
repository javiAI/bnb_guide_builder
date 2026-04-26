/**
 * Audit writes are intentionally NOT inside this wrapper — `writeAudit()`
 * stays explicit at each mutation call site so the audit trail is grep-able
 * (Fase -1 decision of Rama 15D). Pinned by `operator-route-coverage.test.ts`.
 */

import { NextResponse, type NextRequest } from "next/server";
import { handleOwnershipApiError } from "@/lib/auth/route-helpers";
import { loadOwnedProperty, type OwnedPropertyResult } from "@/lib/auth/owned-property";
import {
  applyOperatorRateLimit,
  type OperatorRateLimitBucket,
} from "@/lib/services/operator-rate-limit";

export interface OperatorGuardOptions {
  rateLimit: OperatorRateLimitBucket;
}

export interface OperatorGuardContext<P extends Record<string, unknown>> {
  params: P;
  guarded: OwnedPropertyResult;
}

export type OperatorRouteHandler<P extends Record<string, unknown>> = (
  request: NextRequest,
  ctx: OperatorGuardContext<P>,
) => Promise<Response> | Response;

export function withOperatorGuards<
  P extends { propertyId: string } & Record<string, unknown>,
>(
  handler: OperatorRouteHandler<P>,
  opts: OperatorGuardOptions,
): (
  request: NextRequest,
  args: { params: Promise<P> },
) => Promise<Response> {
  return async function guardedHandler(request, args) {
    const params = await args.params;

    let guarded: OwnedPropertyResult;
    try {
      guarded = await loadOwnedProperty(params.propertyId);
    } catch (err) {
      return handleOwnershipApiError(err);
    }

    const gate = applyOperatorRateLimit({
      userId: guarded.operator.userId,
      bucket: opts.rateLimit,
    });
    if (!gate.ok) {
      return NextResponse.json(
        {
          error: {
            code: "RATE_LIMITED",
            message: "Too many requests. Slow down and retry.",
          },
        },
        {
          status: 429,
          headers: { "Retry-After": String(gate.retryAfterSeconds) },
        },
      );
    }

    return handler(request, { params, guarded });
  };
}
