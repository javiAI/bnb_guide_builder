// Non-happy paths: unknown tokens with Levenshtein suggestion, missing state
// for known-but-empty sources, and unresolved_context for the reservation
// group. Also locks in substitution rules for each state.

import { describe, it, expect, vi, beforeEach } from "vitest";

const { propertyMock, contactMock, amenityMock, knowledgeMock } = vi.hoisted(
  () => ({
    propertyMock: vi.fn<(args: unknown) => Promise<unknown>>(),
    contactMock: vi.fn<(args: unknown) => Promise<unknown[]>>(),
    amenityMock: vi.fn<(args: unknown) => Promise<unknown[]>>(),
    knowledgeMock: vi.fn<(args: unknown) => Promise<unknown[]>>(),
  }),
);

vi.mock("@/lib/db", () => ({
  prisma: {
    property: { findUniqueOrThrow: propertyMock },
    contact: { findMany: contactMock },
    propertyAmenityInstance: { findMany: amenityMock },
    knowledgeItem: { findMany: knowledgeMock },
  },
}));

import {
  resolveVariables,
  suggestVariable,
  levenshtein,
} from "@/lib/services/messaging-variables.service";

const EMPTY_PROPERTY = {
  id: "prop_empty",
  propertyNickname: "Casa vacía",
  propertyType: null,
  checkInStart: null,
  checkInEnd: null,
  checkOutTime: null,
  city: null,
  country: null,
  timezone: null,
  streetAddress: null,
  maxGuests: null,
  publicSlug: null,
  accessMethodsJson: null,
  policiesJson: null,
  customAccessMethodDesc: null,
  primaryAccessMethod: null,
  defaultLocale: "es",
};

beforeEach(() => {
  propertyMock.mockReset();
  contactMock.mockReset();
  amenityMock.mockReset();
  knowledgeMock.mockReset();

  propertyMock.mockResolvedValue(EMPTY_PROPERTY);
  contactMock.mockResolvedValue([]);
  amenityMock.mockResolvedValue([]);
  knowledgeMock.mockResolvedValue([]);
});

// ── Unknown + suggestions ──

describe("resolveVariables — unknown tokens + suggestions", () => {
  it("marks unknown tokens and proposes the closest known variable", async () => {
    const result = await resolveVariables(
      "prop_empty",
      "Hola {{guest_nmae}} en {{property_nam}}.",
    );

    expect(result.unknown).toEqual(["guest_nmae", "property_nam"]);
    expect(result.states.guest_nmae).toEqual({
      status: "unknown",
      suggestion: "guest_name",
    });
    expect(result.states.property_nam).toEqual({
      status: "unknown",
      suggestion: "property_name",
    });
    // Unknown tokens are preserved verbatim in the output so the host notices.
    expect(result.output).toBe("Hola {{guest_nmae}} en {{property_nam}}.");
  });

  it("returns suggestion: null when no known variable is within the threshold", async () => {
    const result = await resolveVariables(
      "prop_empty",
      "{{completely_unrelated_token_xyz}}",
    );
    expect(result.states.completely_unrelated_token_xyz).toEqual({
      status: "unknown",
      suggestion: null,
    });
  });

  it("suggestVariable: exposes public helper for unit testing", () => {
    expect(suggestVariable("guest_nam")).toBe("guest_name");
    expect(suggestVariable("zzz")).toBeNull();
  });

  it("levenshtein: covers empty + identity + substitution", () => {
    expect(levenshtein("", "abc")).toBe(3);
    expect(levenshtein("abc", "")).toBe(3);
    expect(levenshtein("abc", "abc")).toBe(0);
    expect(levenshtein("abc", "abd")).toBe(1);
  });

  it("all-unknown template skips DB calls entirely", async () => {
    await resolveVariables("prop_empty", "{{nope_one}} {{nope_two}}");
    expect(propertyMock).not.toHaveBeenCalled();
    expect(contactMock).not.toHaveBeenCalled();
    expect(amenityMock).not.toHaveBeenCalled();
    expect(knowledgeMock).not.toHaveBeenCalled();
  });
});

// ── Missing state ──

describe("resolveVariables — missing state (known + empty source)", () => {
  it("produces missing for property_field with null data, renders [Falta: Label]", async () => {
    const result = await resolveVariables(
      "prop_empty",
      "Check-in {{check_in_time}} en {{city}}.",
    );

    expect(result.missing).toEqual(["check_in_time", "city"]);
    expect(result.states.check_in_time).toEqual({
      status: "missing",
      label: "Hora de check-in",
    });
    expect(result.states.city).toEqual({
      status: "missing",
      label: "Ciudad",
    });
    expect(result.output).toBe(
      "Check-in [Falta: Hora de check-in] en [Falta: Ciudad].",
    );
  });

  it("produces missing for contact variables when no role in the fallback chain resolves", async () => {
    const result = await resolveVariables(
      "prop_empty",
      "{{support_contact_phone}}",
    );
    expect(result.states.support_contact_phone).toEqual({
      status: "missing",
      label: "Teléfono de soporte",
    });
    expect(result.output).toBe("[Falta: Teléfono de soporte]");
  });

  it("produces missing for derived guide_url when publicSlug is null", async () => {
    const result = await resolveVariables("prop_empty", "{{guide_url}}");
    expect(result.states.guide_url).toEqual({
      status: "missing",
      label: "URL de la guía",
    });
  });

  it("produces missing for knowledge_item topics when canonical empty and no KI present", async () => {
    const result = await resolveVariables(
      "prop_empty",
      "{{pet_policy}} / {{parking_instructions}}",
    );
    expect(result.states.pet_policy).toEqual({
      status: "missing",
      label: "Política de mascotas",
    });
    expect(result.states.parking_instructions).toEqual({
      status: "missing",
      label: "Instrucciones de parking",
    });
  });

  it("composes checkInWindow from start+end but degrades gracefully", async () => {
    // Only start is set → resolver falls back to single value.
    propertyMock.mockResolvedValueOnce({
      ...EMPTY_PROPERTY,
      checkInStart: "15:00",
    });
    const result = await resolveVariables("prop_empty", "{{check_in_window}}");
    expect(result.states.check_in_window).toMatchObject({
      status: "resolved",
      value: "15:00",
    });
  });
});

// ── Unresolved context (reservation group) ──

describe("resolveVariables — unresolved_context (reservation group)", () => {
  it("never marks reservation variables as missing, even with empty property", async () => {
    const body =
      "Hola {{guest_name}} — {{check_in_date}} → {{check_out_date}} ({{num_guests}}).";
    const result = await resolveVariables("prop_empty", body);

    expect(result.unresolvedContext).toEqual([
      "guest_name",
      "check_in_date",
      "check_out_date",
      "num_guests",
    ]);
    expect(result.missing).toEqual([]);
    expect(result.unknown).toEqual([]);

    // All four render as `[Label]` placeholders, distinct from `[Falta: …]`.
    expect(result.output).toBe(
      "Hola [Nombre del huésped] — [Fecha de check-in] → [Fecha de check-out] ([Nº de huéspedes]).",
    );
  });

  it("reservation state object shape is { status: 'unresolved_context', label }", async () => {
    const result = await resolveVariables("prop_empty", "{{guest_name}}");
    expect(result.states.guest_name).toEqual({
      status: "unresolved_context",
      label: "Nombre del huésped",
    });
  });
});

// ── Mixed states in a single template ──

describe("resolveVariables — mixed states", () => {
  it("categorises each token into exactly one bucket", async () => {
    const body =
      "{{guest_name}} {{check_in_time}} {{custom_var}} {{property_name}}";
    propertyMock.mockResolvedValueOnce({
      ...EMPTY_PROPERTY,
      propertyNickname: "Casa Test",
      // check_in_time still null → missing
    });

    const result = await resolveVariables("prop_empty", body);

    expect(result.resolved).toEqual(["property_name"]);
    expect(result.missing).toEqual(["check_in_time"]);
    expect(result.unknown).toEqual(["custom_var"]);
    expect(result.unresolvedContext).toEqual(["guest_name"]);
  });
});
