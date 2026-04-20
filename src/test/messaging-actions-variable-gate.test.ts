// Blocking-validation gate on server actions: create + update must reject
// unknown `{{var}}` tokens with a Spanish fieldError on bodyMd and NEVER
// touch prisma. Missing/unresolved_context remain non-blocking (not covered
// at action level — the gate only blocks unknowns, per 12A contract).

import { describe, it, expect, vi, beforeEach } from "vitest";

const { createMock, updateMock } = vi.hoisted(() => ({
  createMock: vi.fn<(args: unknown) => Promise<unknown>>(),
  updateMock: vi.fn<(args: unknown) => Promise<unknown>>(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    messageTemplate: {
      create: createMock,
      update: updateMock,
    },
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import {
  createMessageTemplateAction,
  updateMessageTemplateAction,
} from "@/lib/actions/messaging.actions";

function formData(data: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(data)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  createMock.mockReset();
  updateMock.mockReset();
  createMock.mockResolvedValue({ id: "tmpl_new" });
  updateMock.mockResolvedValue({ id: "tmpl_existing" });
});

describe("createMessageTemplateAction — variable gate", () => {
  it("rejects unknown variables with a Spanish fieldError on bodyMd and skips DB", async () => {
    const fd = formData({
      propertyId: "prop_1",
      touchpointKey: "mtp.booking_confirmed",
      bodyMd: "Hola {{guest_nmae}}",
    });
    const result = await createMessageTemplateAction(null, fd);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.fieldErrors?.bodyMd).toBeDefined();
      expect(result.fieldErrors?.bodyMd?.[0]).toBe(
        "Variable desconocida {{guest_nmae}}. ¿Quisiste decir {{guest_name}}?",
      );
    }
    expect(createMock).not.toHaveBeenCalled();
  });

  it("accepts known variables (including reservation/missing) and calls DB", async () => {
    const fd = formData({
      propertyId: "prop_1",
      touchpointKey: "mtp.booking_confirmed",
      bodyMd: "Hola {{guest_name}}, check-in {{check_in_time}}.",
    });
    const result = await createMessageTemplateAction(null, fd);
    expect(result.success).toBe(true);
    expect(createMock).toHaveBeenCalledTimes(1);
  });
});

describe("updateMessageTemplateAction — variable gate", () => {
  it("rejects unknown variables and skips DB update", async () => {
    const fd = formData({
      templateId: "tmpl_existing",
      propertyId: "prop_1",
      bodyMd: "Texto con {{cuidad}}",
    });
    const result = await updateMessageTemplateAction(null, fd);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.fieldErrors?.bodyMd?.[0]).toContain(
        "Variable desconocida {{cuidad}}",
      );
    }
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("accepts known variables on update", async () => {
    const fd = formData({
      templateId: "tmpl_existing",
      propertyId: "prop_1",
      bodyMd: "OK {{property_name}}",
    });
    const result = await updateMessageTemplateAction(null, fd);
    expect(result.success).toBe(true);
    expect(updateMock).toHaveBeenCalledTimes(1);
  });
});
