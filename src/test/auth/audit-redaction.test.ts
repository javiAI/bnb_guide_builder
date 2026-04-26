import { describe, it, expect } from "vitest";
import { redactSecretsForAudit } from "@/lib/services/audit.service";

/**
 * Pins the redaction contract for AuditLog.diffJson — never persist secrets
 * via writeAudit() diff payloads. The list mirrors SECURITY_AND_AUDIT.md §3.
 */
describe("audit redaction invariants", () => {
  it("redacts access_code / password / api_key by key name", () => {
    const out = redactSecretsForAudit({
      access_code: "1234",
      "access-code": "1234",
      password: "hunter2",
      api_key: "sk-abc",
      apiKey: "sk-def",
      authorization: "Bearer xyz",
      hidden_key_location: "under the mat",
    }) as Record<string, unknown>;
    expect(out.access_code).toBe("[REDACTED]");
    expect(out["access-code"]).toBe("[REDACTED]");
    expect(out.password).toBe("[REDACTED]");
    expect(out.api_key).toBe("[REDACTED]");
    expect(out.apiKey).toBe("[REDACTED]");
    expect(out.authorization).toBe("[REDACTED]");
    expect(out.hidden_key_location).toBe("[REDACTED]");
  });

  it("redacts smart-lock variants by key name", () => {
    const out = redactSecretsForAudit({
      smart_lock_code: "1111",
      "smart-lock-key": "abc",
      smartLockCredential: "xyz",
      key_location: "under the mat",
    }) as Record<string, unknown>;
    expect(out.smart_lock_code).toBe("[REDACTED]");
    expect(out["smart-lock-key"]).toBe("[REDACTED]");
    expect(out.smartLockCredential).toBe("[REDACTED]");
    expect(out.key_location).toBe("[REDACTED]");
  });

  it("redacts X-Amz-* AWS signature headers", () => {
    const out = redactSecretsForAudit({
      "x-amz-signature": "abc",
      "X-Amz-Date": "20260101T000000Z",
    }) as Record<string, unknown>;
    expect(out["x-amz-signature"]).toBe("[REDACTED]");
    expect(out["X-Amz-Date"]).toBe("[REDACTED]");
  });

  it("redacts presigned R2 URLs by value pattern", () => {
    const out = redactSecretsForAudit({
      url: "https://abc.r2.cloudflarestorage.com/bucket/file?X-Amz-Signature=xyz",
      safe: "https://example.com/normal",
    }) as Record<string, unknown>;
    expect(out.url).toBe("[REDACTED]");
    expect(out.safe).toBe("https://example.com/normal");
  });

  it("preserves non-secret values verbatim", () => {
    const input = {
      title: "Wi-Fi caído",
      severity: "high",
      version: 7,
      tags: ["urgent", "wifi"],
      visibility: "internal",
    };
    expect(redactSecretsForAudit(input)).toEqual(input);
  });

  it("recurses into nested objects and arrays", () => {
    const out = redactSecretsForAudit({
      meta: { password: "x" },
      items: [{ access_code: "1" }, { ok: "v" }],
    }) as { meta: Record<string, unknown>; items: Record<string, unknown>[] };
    expect(out.meta.password).toBe("[REDACTED]");
    expect(out.items[0].access_code).toBe("[REDACTED]");
    expect(out.items[1].ok).toBe("v");
  });

  it("survives circular references without throwing", () => {
    const a: Record<string, unknown> = { name: "a" };
    a.self = a;
    expect(() => redactSecretsForAudit(a)).not.toThrow();
  });

  it("caps recursion depth (no stack overflow)", () => {
    let deep: Record<string, unknown> = { leaf: "v" };
    for (let i = 0; i < 50; i++) deep = { nested: deep };
    expect(() => redactSecretsForAudit(deep)).not.toThrow();
  });
});
