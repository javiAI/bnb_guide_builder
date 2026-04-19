import { describe, expect, it } from "vitest";
import {
  askResponseSchema,
  escalationResolutionSchema,
} from "@/lib/schemas/assistant.schema";

describe("assistant schema — escalationContact", () => {
  it("askResponseSchema requires escalationContact (nullable)", () => {
    // Missing field should fail validation — this guards against a server
    // accidentally dropping the key from the response envelope.
    const result = askResponseSchema.safeParse({
      answer: "ok",
      citations: [],
      confidenceScore: 0.5,
      escalated: false,
      escalationReason: null,
      conversationId: "c1",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a resolved escalation contact envelope", () => {
    const envelope = {
      answer: "",
      citations: [],
      confidenceScore: 0,
      escalated: true,
      escalationReason: "lockout",
      conversationId: "c1",
      escalationContact: {
        intentId: "int.lockout",
        intentLabel: "Sin acceso",
        emergencyPriority: false,
        fallbackLevel: "intent",
        contacts: [
          {
            id: "c1",
            roleKey: "ct.locksmith",
            displayName: "Cerrajero 24h",
            channels: [
              { kind: "tel", rawValue: "+34600", href: "tel:+34600" },
              { kind: "whatsapp", rawValue: "+34600", href: "https://wa.me/34600" },
            ],
            emergencyAvailable: true,
            isPrimary: true,
            notes: null,
          },
        ],
      },
    };
    const result = askResponseSchema.safeParse(envelope);
    expect(result.success).toBe(true);
  });

  it("rejects invalid intentId format (must be int.*)", () => {
    const result = escalationResolutionSchema.safeParse({
      intentId: "lockout", // missing prefix
      intentLabel: "Lockout",
      emergencyPriority: false,
      fallbackLevel: "intent",
      contacts: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown fallbackLevel", () => {
    const result = escalationResolutionSchema.safeParse({
      intentId: "int.lockout",
      intentLabel: "Sin acceso",
      emergencyPriority: false,
      fallbackLevel: "magic", // not in enum
      contacts: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a channel kind outside tel/whatsapp/email", () => {
    const result = escalationResolutionSchema.safeParse({
      intentId: "int.lockout",
      intentLabel: "Sin acceso",
      emergencyPriority: false,
      fallbackLevel: "intent",
      contacts: [
        {
          id: "c1",
          roleKey: "ct.locksmith",
          displayName: "X",
          channels: [{ kind: "sms", rawValue: "+34600", href: "sms:+34600" }],
          emergencyAvailable: false,
          isPrimary: false,
          notes: null,
        },
      ],
    });
    expect(result.success).toBe(false);
  });
});
