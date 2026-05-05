import { describe, it, expect, vi } from "vitest";
import { buildContextPrefix } from "@/lib/services/knowledge-extract.service";
import type { VisibilityLevel } from "@/lib/visibility";
import { CHUNK_TYPES, ENTITY_TYPES } from "@/lib/types/knowledge";

// This file tests that buildContextPrefix produces the spec-compliant multi-line
// format for every chunkType and entityType, and never embeds raw taxonomy keys
// (e.g. am.wifi, ct.host, sys.internet) that are internal identifiers.

// Local substring scanner — detects taxonomy keys embedded in longer text.
// The canonical TAXONOMY_KEY_PATTERN is full-string-anchored and cannot detect substrings,
// but context-prefix output is prose (sentences), so a leak like "am.wifi" appears as a substring.
const TAXONOMY_KEY_IN_TEXT = /\b(am|ct|sys|sp|pt|rm|pol)\.[a-z_]+\b/;

vi.mock("@/lib/db", () => ({
  prisma: {},
}));

const ALL_ENTITY_SECTION_LABELS: Record<string, string> = {
  property: "General",
  access: "Llegada e instrucciones de acceso",
  policy: "Normas y políticas",
  contact: "Contactos",
  amenity: "Equipamiento",
  space: "Espacios",
  system: "Sistemas",
};

describe("buildContextPrefix — spec format", () => {
  it("always starts with Propiedad line", () => {
    const result = buildContextPrefix({
      propertyName: "Casa Mar",
      city: "Palma",
      sectionLabel: "Esenciales",
      entityLabel: "WiFi",
      visibility: "guest",
      canonicalQuestion: "¿Cuál es la contraseña?",
    });
    expect(result.split("\n")[0]).toMatch(/^Propiedad:/);
  });

  it("always has exactly 5 lines", () => {
    const result = buildContextPrefix({
      propertyName: "Test",
      city: null,
      sectionLabel: "General",
      entityLabel: "Overview",
      visibility: "guest",
      canonicalQuestion: "¿Qué es esto?",
    });
    expect(result.split("\n")).toHaveLength(5);
  });

  it.each(CHUNK_TYPES)(
    "produces valid prefix for chunkType=%s",
    (chunkType) => {
      const prefix = buildContextPrefix({
        propertyName: "Finca Rural",
        city: "Granada",
        sectionLabel: "Equipamiento",
        entityLabel: `Servicio de ${chunkType}`,
        visibility: "guest",
        canonicalQuestion: `¿Cómo funciona ${chunkType}?`,
      });
      expect(prefix).toContain("Propiedad: Finca Rural, Granada.");
      expect(prefix).toContain(`Pregunta que responde: "¿Cómo funciona ${chunkType}?"`);
    },
  );

  it.each(ENTITY_TYPES)(
    "produces valid prefix for entityType=%s",
    (entityType) => {
      const sectionLabel = ALL_ENTITY_SECTION_LABELS[entityType];
      const prefix = buildContextPrefix({
        propertyName: "Apartamento Centro",
        city: "Sevilla",
        sectionLabel,
        entityLabel: "Detalle de prueba",
        visibility: "guest",
        canonicalQuestion: "¿Pregunta de prueba?",
      });
      expect(prefix).toContain(`Sección: ${sectionLabel} > Detalle de prueba.`);
    },
  );

  it("never contains raw taxonomy key patterns (am.*, ct.*, sys.*, sp.*)", () => {
    const prefixes = [
      buildContextPrefix({
        propertyName: "Test",
        city: "Madrid",
        sectionLabel: "Equipamiento",
        entityLabel: "WiFi",
        visibility: "guest",
        canonicalQuestion: "¿Cuál es la contraseña del WiFi?",
      }),
      buildContextPrefix({
        propertyName: "Test",
        city: null,
        sectionLabel: "Contactos",
        entityLabel: "Anfitrión",
        visibility: "guest",
        canonicalQuestion: "¿A quién contacto?",
      }),
      buildContextPrefix({
        propertyName: "Test",
        city: "BCN",
        sectionLabel: "Sistemas",
        entityLabel: "Calefacción",
        visibility: "internal",
        canonicalQuestion: "¿Cómo funciona la calefacción?",
      }),
    ];
    for (const prefix of prefixes) {
      expect(prefix).not.toMatch(TAXONOMY_KEY_IN_TEXT);
    }
  });

  it("sanitizes visibility labels correctly for all levels", () => {
    const levels: Array<{ v: VisibilityLevel; expectedAudience: string; expectedSensitivity: string }> = [
      { v: "guest", expectedAudience: "huéspedes", expectedSensitivity: "baja" },
      { v: "ai", expectedAudience: "IA", expectedSensitivity: "media" },
      { v: "internal", expectedAudience: "interno", expectedSensitivity: "alta" },
    ];
    for (const { v, expectedAudience, expectedSensitivity } of levels) {
      const prefix = buildContextPrefix({
        propertyName: "T",
        city: null,
        sectionLabel: "S",
        entityLabel: "E",
        visibility: v,
        canonicalQuestion: "Q",
      });
      expect(prefix).toContain(expectedAudience);
      expect(prefix).toContain(expectedSensitivity);
    }
  });
});
