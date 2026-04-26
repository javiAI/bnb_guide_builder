import { NextResponse } from "next/server";
import { z } from "zod";

import type { OperatorRouteHandler } from "@/lib/auth/operator-guards";
import {
  applyImportDiff,
  ImportPayloadParseError,
  type ImportPlatform,
} from "@/lib/imports/shared/import-applier.service";

const applyRequestSchema = z.object({
  payload: z.unknown(),
  resolutions: z.record(
    z.string(),
    z.enum(["take_import", "keep_current", "skip"]),
  ),
});

export function applyImportHandler(
  platform: ImportPlatform,
): OperatorRouteHandler<{ propertyId: string }> {
  return async (request, { params, guarded }) => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: { code: "INVALID_JSON", message: "Invalid JSON body" } },
        { status: 400 },
      );
    }

    const parsed = applyRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_BODY",
            message: "Body must include payload + resolutions",
            issues: parsed.error.issues.map(
              (i) => `${i.path.join(".") || "<root>"}: ${i.message}`,
            ),
          },
        },
        { status: 400 },
      );
    }

    let result;
    try {
      result = await applyImportDiff({
        propertyId: params.propertyId,
        platform,
        payload: parsed.data.payload,
        resolutions: parsed.data.resolutions,
        actorUserId: guarded.operator.userId,
      });
    } catch (err) {
      if (err instanceof ImportPayloadParseError) {
        return NextResponse.json(
          {
            error: {
              code: "INVALID_PAYLOAD",
              message: err.message,
              issues: [...err.issues],
            },
          },
          { status: 400 },
        );
      }
      throw err;
    }

    if (result.result === "stale") {
      return NextResponse.json(
        {
          error: {
            code: "STALE_RESOLUTIONS",
            diff: result.diff,
            missingFields: result.missingFields,
          },
        },
        { status: 409 },
      );
    }
    if (result.result === "invalid") {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_RESOLUTION",
            field: result.field,
            reason: result.reason,
            message: result.message,
          },
        },
        { status: 400 },
      );
    }
    if (result.result === "failed") {
      return NextResponse.json(
        {
          error: {
            code: "APPLY_FAILED",
            message: result.error,
            payloadFingerprint: result.payloadFingerprint,
          },
        },
        { status: 500 },
      );
    }
    return NextResponse.json({ data: result });
  };
}
