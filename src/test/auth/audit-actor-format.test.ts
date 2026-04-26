import { describe, it, expect } from "vitest";
import { formatActor } from "@/lib/services/audit.service";

/**
 * Pinning invariant — actor strings persisted to AuditLog.actor must follow
 * one of three exact shapes so downstream queries can filter without parsing
 * heuristics. If you need a new actor type, add a branch to formatActor() and
 * extend the regex here in the same change.
 */
const ACTOR_REGEX = /^(user:[A-Za-z0-9_-]+|guest:[A-Za-z0-9-]+|system:[a-z][A-Za-z0-9_-]*)$/;

describe("audit actor format invariant", () => {
  it("user actor formats as user:<userId>", () => {
    const actor = formatActor({ type: "user", userId: "ckusr0123abcdef" });
    expect(actor).toBe("user:ckusr0123abcdef");
    expect(actor).toMatch(ACTOR_REGEX);
  });

  it("guest actor formats as guest:<slug>", () => {
    const actor = formatActor({ type: "guest", slug: "casa-marbella-3b" });
    expect(actor).toBe("guest:casa-marbella-3b");
    expect(actor).toMatch(ACTOR_REGEX);
  });

  it("system actor formats as system:<job>", () => {
    const actor = formatActor({ type: "system", job: "embed_backfill" });
    expect(actor).toBe("system:embed_backfill");
    expect(actor).toMatch(ACTOR_REGEX);
  });

  it("rejects nothing of the three known shapes — round-trip invariant", () => {
    for (const input of [
      { type: "user" as const, userId: "abc123" },
      { type: "guest" as const, slug: "foo-bar-baz" },
      { type: "system" as const, job: "auditor" },
    ]) {
      expect(formatActor(input)).toMatch(ACTOR_REGEX);
    }
  });

  it("never produces an empty or namespace-only actor", () => {
    const samples = [
      formatActor({ type: "user", userId: "u" }),
      formatActor({ type: "guest", slug: "s" }),
      formatActor({ type: "system", job: "j" }),
    ];
    for (const a of samples) {
      const [, suffix] = a.split(":");
      expect(suffix.length).toBeGreaterThan(0);
    }
  });
});
