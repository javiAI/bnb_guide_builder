import { describe, it, expect } from "vitest";
import {
  buildContextPrefix,
  buildBm25Text,
  buildContentHash,
} from "@/lib/services/knowledge-extract.service";

// Contextual retrieval requires that every KnowledgeItem stored in the
// corpus carries a prefix describing WHO this item is for and WHAT question
// it answers. These tests pin down that shape so an accidental rewrite of
// the extractor does not silently change the retrieval signal.

describe("buildContextPrefix", () => {
  const base = {
    propertyName: "Apartamento Sol",
    city: "Málaga",
    sectionLabel: "Sistemas",
    entityLabel: "Calefacción",
    visibility: "guest" as const,
    canonicalQuestion: "¿Cómo se enciende la calefacción?",
  };

  it("emits all five mandatory lines (property, section, audience, sensitivity, question)", () => {
    const prefix = buildContextPrefix(base);
    const lines = prefix.split("\n");
    expect(lines).toHaveLength(5);
    expect(lines[0]).toContain("Apartamento Sol");
    expect(lines[0]).toContain("Málaga");
    expect(lines[1]).toContain("Sistemas");
    expect(lines[1]).toContain("Calefacción");
    expect(lines[2]).toMatch(/huésped|guest/i);
    expect(lines[3]).toMatch(/sensib|sensit/i);
    expect(lines[4]).toContain("¿Cómo se enciende la calefacción?");
  });

  it("omits the city clause when city is null", () => {
    const prefix = buildContextPrefix({ ...base, city: null });
    expect(prefix).not.toContain(", ,");
    expect(prefix).toContain("Apartamento Sol");
  });

  it("emits the English variant when locale=en", () => {
    const prefix = buildContextPrefix({ ...base, locale: "en" });
    expect(prefix).toMatch(/^Property:/);
    expect(prefix).toMatch(/Section:/);
    expect(prefix).toMatch(/Intended for:/);
    expect(prefix).toMatch(/Sensitivity:/);
    expect(prefix).toMatch(/Question this answers:/);
  });

  it("changes when visibility changes (contextual signal differs for guest vs internal)", () => {
    const guest = buildContextPrefix(base);
    const internal = buildContextPrefix({ ...base, visibility: "internal" });
    expect(guest).not.toBe(internal);
  });
});

describe("buildBm25Text", () => {
  it("strips diacritics, lowercases, removes Spanish stopwords", () => {
    const out = buildBm25Text(
      "Propiedad: X. Sección: Sistemas.",
      "La calefacción se enciende con el termostato.",
      "es",
    );
    expect(out).toContain("calefaccion");
    expect(out).toContain("termostato");
    expect(out).not.toMatch(/\b(la|se|el|con)\b/);
  });

  it("uses English stopwords when locale=en", () => {
    const out = buildBm25Text(
      "Property: X. Section: Systems.",
      "The heater is turned on with the thermostat.",
      "en",
    );
    expect(out).toContain("heater");
    expect(out).toContain("thermostat");
    expect(out).not.toMatch(/\bthe\b/);
    expect(out).not.toMatch(/\bwith\b/);
  });
});

describe("buildContentHash", () => {
  it("is deterministic and changes when body or prefix changes", () => {
    const a = buildContentHash("P", "body");
    const b = buildContentHash("P", "body");
    const c = buildContentHash("P", "BODY");
    const d = buildContentHash("P2", "body");
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).not.toBe(d);
    expect(a).toHaveLength(16);
  });
});
