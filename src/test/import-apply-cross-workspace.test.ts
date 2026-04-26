import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

import { PropertyForbiddenError } from "@/lib/auth/errors";

const loadOwnedProperty = vi.fn();
const applyImportDiff = vi.fn();
const applyOperatorRateLimit = vi.fn().mockReturnValue({ ok: true });

vi.mock("@/lib/auth/owned-property", () => ({
  loadOwnedProperty: (id: string) => loadOwnedProperty(id),
}));

vi.mock("@/lib/services/operator-rate-limit", () => ({
  applyOperatorRateLimit: (arg: unknown) => applyOperatorRateLimit(arg),
}));

vi.mock("@/lib/imports/shared/import-applier.service", () => ({
  applyImportDiff: (arg: unknown) => applyImportDiff(arg),
  ImportPayloadParseError: class ImportPayloadParseError extends Error {},
}));

import { POST as airbnbApply } from "@/app/api/properties/[propertyId]/import/airbnb/apply/route";
import { POST as bookingApply } from "@/app/api/properties/[propertyId]/import/booking/apply/route";

function makeRequest(): NextRequest {
  return new NextRequest("http://localhost/x", {
    method: "POST",
    body: JSON.stringify({ payload: {}, resolutions: {} }),
  });
}

describe("apply routes — cross-workspace ownership is rejected before the applier runs", () => {
  beforeEach(() => {
    loadOwnedProperty.mockReset();
    applyImportDiff.mockReset();
    applyOperatorRateLimit.mockClear();
    loadOwnedProperty.mockRejectedValue(
      new PropertyForbiddenError("forbidden"),
    );
  });

  it("airbnb: operator from workspace A → property from workspace B → 403, applier never called", async () => {
    const res = await airbnbApply(makeRequest(), {
      params: Promise.resolve({ propertyId: "prop_in_other_ws" }),
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("FORBIDDEN");
    expect(applyImportDiff).not.toHaveBeenCalled();
    expect(applyOperatorRateLimit).not.toHaveBeenCalled();
  });

  it("booking: operator from workspace A → property from workspace B → 403, applier never called", async () => {
    const res = await bookingApply(makeRequest(), {
      params: Promise.resolve({ propertyId: "prop_in_other_ws" }),
    });
    expect(res.status).toBe(403);
    expect(applyImportDiff).not.toHaveBeenCalled();
    expect(applyOperatorRateLimit).not.toHaveBeenCalled();
  });
});
