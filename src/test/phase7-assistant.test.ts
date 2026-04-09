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
      expect(result.data.audience).toBe("public");
    }
  });

  it("accepts audience booked_guest", () => {
    const result = askRequestSchema.safeParse({
      question: "¿Código de la puerta?",
      audience: "booked_guest",
    });
    expect(result.success).toBe(true);
  });

  it("rejects secret audience", () => {
    const result = askRequestSchema.safeParse({
      question: "test",
      audience: "secret",
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
      audience: "public",
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
      expect(result.data.audience).toBe("public");
      expect(result.data.language).toBe("es");
    }
  });
});

describe("Citation schema", () => {
  it("accepts valid citation", () => {
    const result = citationSchema.safeParse({
      knowledgeItemId: "ki_1",
      sourceId: null,
      quoteOrNote: "WiFi info",
      relevanceScore: 0.9,
    });
    expect(result.success).toBe(true);
  });

  it("rejects relevanceScore > 1", () => {
    const result = citationSchema.safeParse({
      knowledgeItemId: "ki_1",
      sourceId: null,
      quoteOrNote: null,
      relevanceScore: 1.5,
    });
    expect(result.success).toBe(false);
  });
});
