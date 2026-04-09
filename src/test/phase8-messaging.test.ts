import { describe, it, expect } from "vitest";
import {
  createMessageTemplateSchema,
  updateMessageTemplateSchema,
  createMessageAutomationSchema,
  extractVariables,
  validateVariables,
  KNOWN_VARIABLES,
} from "@/lib/schemas/messaging.schema";
import { messagingTouchpoints, automationChannels, getItems } from "@/lib/taxonomy-loader";

describe("Message template schemas", () => {
  it("rejects empty touchpointKey", () => {
    const result = createMessageTemplateSchema.safeParse({
      touchpointKey: "",
      bodyMd: "Hola",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty body", () => {
    const result = createMessageTemplateSchema.safeParse({
      touchpointKey: "mtp.booking_confirmed",
      bodyMd: "",
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid template", () => {
    const result = createMessageTemplateSchema.safeParse({
      touchpointKey: "mtp.booking_confirmed",
      bodyMd: "Hola {{guest_name}}, bienvenido.",
    });
    expect(result.success).toBe(true);
  });

  it("update accepts status change", () => {
    const result = updateMessageTemplateSchema.safeParse({
      bodyMd: "Updated body",
      status: "active",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("active");
    }
  });

  it("update rejects invalid status", () => {
    const result = updateMessageTemplateSchema.safeParse({
      bodyMd: "Body",
      status: "invalid",
    });
    expect(result.success).toBe(false);
  });
});

describe("Message automation schemas", () => {
  it("rejects empty templateId", () => {
    const result = createMessageAutomationSchema.safeParse({
      touchpointKey: "mtp.booking_confirmed",
      templateId: "",
      channelKey: "ota_inbox",
      triggerType: "reservation_relative",
      sendOffsetMinutes: 5,
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid automation", () => {
    const result = createMessageAutomationSchema.safeParse({
      touchpointKey: "mtp.day_of_checkin",
      templateId: "tmpl_1",
      channelKey: "whatsapp",
      triggerType: "reservation_relative",
      sendOffsetMinutes: -120,
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid triggerType", () => {
    const result = createMessageAutomationSchema.safeParse({
      touchpointKey: "mtp.day_of_checkin",
      templateId: "tmpl_1",
      channelKey: "whatsapp",
      triggerType: "cron",
      sendOffsetMinutes: 0,
    });
    expect(result.success).toBe(false);
  });
});

describe("Variable validation", () => {
  it("extracts variables from template body", () => {
    const vars = extractVariables("Hola {{guest_name}}, tu check-in es a las {{check_in_time}}.");
    expect(vars).toEqual(["guest_name", "check_in_time"]);
  });

  it("deduplicates variables", () => {
    const vars = extractVariables("{{guest_name}} — {{guest_name}}");
    expect(vars).toEqual(["guest_name"]);
  });

  it("returns empty for no variables", () => {
    const vars = extractVariables("Hola, bienvenido.");
    expect(vars).toEqual([]);
  });

  it("validates known vs unknown variables", () => {
    const result = validateVariables("{{guest_name}} y {{custom_var}}");
    expect(result.valid).toEqual(["guest_name"]);
    expect(result.unknown).toEqual(["custom_var"]);
  });

  it("all known variables have labels", () => {
    expect(Object.keys(KNOWN_VARIABLES).length).toBeGreaterThanOrEqual(10);
    for (const [key, label] of Object.entries(KNOWN_VARIABLES)) {
      expect(key).toBeTruthy();
      expect(label).toBeTruthy();
    }
  });
});

describe("Messaging taxonomies", () => {
  it("messaging touchpoints has at least 8 items", () => {
    const items = getItems(messagingTouchpoints);
    expect(items.length).toBeGreaterThanOrEqual(8);
  });

  it("each touchpoint has an id starting with mtp.", () => {
    const items = getItems(messagingTouchpoints);
    for (const item of items) {
      expect(item.id).toMatch(/^mtp\./);
    }
  });

  it("automation channels has 4 items", () => {
    const items = getItems(automationChannels);
    expect(items.length).toBe(4);
  });

  it("channels include ota_inbox, whatsapp, sms, email", () => {
    const items = getItems(automationChannels);
    const ids = items.map((i) => i.id);
    expect(ids).toContain("ota_inbox");
    expect(ids).toContain("whatsapp");
    expect(ids).toContain("sms");
    expect(ids).toContain("email");
  });
});
