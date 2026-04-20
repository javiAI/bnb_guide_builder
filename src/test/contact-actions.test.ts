import { describe, expect, it } from "vitest";
import {
  buildMailtoHref,
  buildTelHref,
  buildWhatsAppHref,
  normalizePhoneForWhatsApp,
} from "@/lib/contact-actions";

describe("normalizePhoneForWhatsApp", () => {
  it("strips non-digits and keeps 7..15 digit runs", () => {
    expect(normalizePhoneForWhatsApp("+34 600 111 222")).toBe("34600111222");
    expect(normalizePhoneForWhatsApp("(91) 123-4567")).toBe("911234567");
  });

  it("returns null for too-short phones", () => {
    expect(normalizePhoneForWhatsApp("12345")).toBeNull();
    expect(normalizePhoneForWhatsApp("")).toBeNull();
  });

  it("returns null for too-long phones", () => {
    expect(normalizePhoneForWhatsApp("1234567890123456")).toBeNull();
  });

  it("accepts boundary lengths (7 and 15 digits)", () => {
    expect(normalizePhoneForWhatsApp("1234567")).toBe("1234567");
    expect(normalizePhoneForWhatsApp("123456789012345")).toBe("123456789012345");
  });
});

describe("buildTelHref", () => {
  it("prepends tel: and strips whitespace", () => {
    expect(buildTelHref("+34 600 111 222")).toBe("tel:+34600111222");
    expect(buildTelHref("911234567")).toBe("tel:911234567");
  });

  it("preserves the + prefix and other tel: legal characters", () => {
    expect(buildTelHref("+1-800-555-0199")).toBe("tel:+1-800-555-0199");
  });
});

describe("buildWhatsAppHref", () => {
  it("produces a wa.me URL with normalized digits", () => {
    expect(buildWhatsAppHref("+34 600 111 222")).toBe(
      "https://wa.me/34600111222",
    );
  });

  it("returns null when the phone can't be normalized", () => {
    expect(buildWhatsAppHref("abc")).toBeNull();
    expect(buildWhatsAppHref("12345")).toBeNull();
  });
});

describe("buildMailtoHref", () => {
  it("trims whitespace and prepends mailto:", () => {
    expect(buildMailtoHref("  host@example.com  ")).toBe(
      "mailto:host@example.com",
    );
  });

  it("returns null for empty / whitespace-only input", () => {
    expect(buildMailtoHref("")).toBeNull();
    expect(buildMailtoHref("   ")).toBeNull();
  });
});
