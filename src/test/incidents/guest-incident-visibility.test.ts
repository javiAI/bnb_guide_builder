// Guest incident visibility whitelist (rama 13D). The API at
// `GET /api/g/:slug/incidents/:id` projects the Incident row through this
// whitelist. Any field absent from the whitelist MUST never leak to the
// guest — relaxing this set is a security decision and should not be made
// silently. If you're adding a new readable field, update this test AND the
// route's `select` AND `projectGuestVisible`.

import { describe, it, expect } from "vitest";
import {
  GUEST_INCIDENT_READABLE_FIELDS,
  guestCanReadIncidentField,
} from "@/lib/visibility";

// Sentinel list of fields that exist on `Incident` and MUST stay invisible
// to the guest. Keeps the whitelist tight as the model grows.
const MUST_BE_HIDDEN = [
  "title",
  "severity",
  "notes",
  "targetType",
  "targetId",
  "playbookId",
  "origin",
  "reporterType",
  "guestContactOptional",
  "visibility",
  "occurredAt",
  "updatedAt",
  "propertyId",
] as const;

describe("guest incident visibility whitelist", () => {
  it("only whitelists a small documented field set", () => {
    expect(GUEST_INCIDENT_READABLE_FIELDS).toEqual([
      "id",
      "status",
      "categoryKey",
      "createdAt",
      "resolvedAt",
    ]);
  });

  it("guestCanReadIncidentField returns true only for whitelisted fields", () => {
    for (const f of GUEST_INCIDENT_READABLE_FIELDS) {
      expect(guestCanReadIncidentField(f)).toBe(true);
    }
  });

  it("rejects every internal-only field", () => {
    for (const f of MUST_BE_HIDDEN) {
      expect(
        guestCanReadIncidentField(f),
        `field "${f}" must never leak to guest`,
      ).toBe(false);
    }
  });

  it("rejects nonsense field names", () => {
    expect(guestCanReadIncidentField("")).toBe(false);
    expect(guestCanReadIncidentField("__proto__")).toBe(false);
    expect(guestCanReadIncidentField("toString")).toBe(false);
  });

  it("list is non-empty (guard against accidental clear)", () => {
    expect(GUEST_INCIDENT_READABLE_FIELDS.length).toBeGreaterThan(0);
  });
});
