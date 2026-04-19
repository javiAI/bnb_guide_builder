import { describe, it, expect } from "vitest";
import {
  askRequestSchema,
  debugRetrieveRequestSchema,
  createConversationSchema,
  citationSchema,
} from "@/lib/schemas/assistant.schema";

describe("Assistant ask schema", () => {
  it("rejects empty question", () => {
    const result = askRequestSchema.safeParse({ question: "" });
    expect(result.success).toBe(false);
  });

  it("accepts valid ask request with defaults", () => {
    const result = askRequestSchema.safeParse({ question: "¿Dónde está el WiFi?" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.language).toBe("es");
      expect(result.data.audience).toBe("guest");
    }
  });

  it("accepts audience ai", () => {
    const result = askRequestSchema.safeParse({
      question: "¿Código de la puerta?",
      audience: "ai",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid audience", () => {
    const result = askRequestSchema.safeParse({
      question: "test",
      audience: "unknown",
    });
    expect(result.success).toBe(false);
  });

  it("accepts optional conversationId", () => {
    const result = askRequestSchema.safeParse({
      question: "test",
      conversationId: "conv_123",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.conversationId).toBe("conv_123");
    }
  });
});

describe("Debug retrieve schema", () => {
  it("rejects empty question", () => {
    const result = debugRetrieveRequestSchema.safeParse({ question: "" });
    expect(result.success).toBe(false);
  });

  it("accepts valid debug request", () => {
    const result = debugRetrieveRequestSchema.safeParse({
      question: "WiFi",
      audience: "internal",
    });
    expect(result.success).toBe(true);
  });
});

describe("Conversation schema", () => {
  it("rejects invalid actorType", () => {
    const result = createConversationSchema.safeParse({
      actorType: "unknown",
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid conversation", () => {
    const result = createConversationSchema.safeParse({
      actorType: "guest",
      audience: "guest",
      language: "es",
    });
    expect(result.success).toBe(true);
  });

  it("applies defaults for audience and language", () => {
    const result = createConversationSchema.safeParse({
      actorType: "operator",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.audience).toBe("guest");
      expect(result.data.language).toBe("es");
    }
  });
});

describe("Citation schema", () => {
  it("accepts valid citation", () => {
    const result = citationSchema.safeParse({
      knowledgeItemId: "ki_1",
      sourceType: "system",
      entityLabel: "WiFi",
      score: 0.9,
    });
    expect(result.success).toBe(true);
  });

  it("rejects score > 1", () => {
    const result = citationSchema.safeParse({
      knowledgeItemId: "ki_1",
      sourceType: "system",
      entityLabel: "WiFi",
      score: 1.5,
    });
    expect(result.success).toBe(false);
  });
});
