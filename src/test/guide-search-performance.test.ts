import { describe, it, expect } from "vitest";
import { createFuseFromIndex } from "@/lib/client/guide-search-index";
import type {
  GuideSearchEntry,
  GuideSearchIndex,
} from "@/lib/types/guide-search-hit";

const SECTION_LABELS = [
  "Equipamiento",
  "Espacios",
  "Llegada",
  "Salida",
  "Normas",
  "Cómo usar",
  "Emergencias",
  "Alrededores",
];

const WORD_POOL = [
  "wifi",
  "parking",
  "aparcamiento",
  "contraseña",
  "llegada",
  "salida",
  "checkout",
  "baño",
  "toallas",
  "cocina",
  "lavadora",
  "cafetera",
  "calefacción",
  "aire",
  "acondicionado",
  "mascota",
  "ruido",
  "silencio",
  "fumar",
  "balcón",
  "terraza",
  "dormitorio",
  "cama",
  "almohada",
  "champú",
  "secador",
  "nevera",
  "horno",
  "microondas",
  "tv",
  "netflix",
  "ascensor",
  "llave",
  "cerradura",
  "código",
];

function synthEntry(i: number): GuideSearchEntry {
  const section = SECTION_LABELS[i % SECTION_LABELS.length];
  const a = WORD_POOL[i % WORD_POOL.length];
  const b = WORD_POOL[(i * 7) % WORD_POOL.length];
  const c = WORD_POOL[(i * 13) % WORD_POOL.length];
  return {
    id: `item-synth.${i}`,
    anchor: `item-synth.${i}`,
    sectionId: `gs.synth${i % SECTION_LABELS.length}`,
    sectionLabel: section,
    label: `Elemento ${a} ${i}`,
    snippet: `Referencia ${b} combinada con ${c}`.slice(0, 160),
    keywords: `${a} ${b} ${c} ${section.toLowerCase()}`,
  };
}

function synthIndex(size: number): GuideSearchIndex {
  const entries = Array.from({ length: size }, (_, i) => synthEntry(i));
  return { buildVersion: "perfperfperf", entries };
}

function percentile(samples: number[], p: number): number {
  const sorted = [...samples].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[idx];
}

describe("guide-search performance", () => {
  it("Fuse.search p95 stays under 20ms on a 200-entry index", () => {
    const fuse = createFuseFromIndex(synthIndex(200));
    const queries = ["wifi", "parking", "llave", "baño", "cafetera"];
    // Warm-up — Fuse lazily builds its index the first time.
    for (const q of queries) fuse.search(q);

    const samples: number[] = [];
    const iterations = 100;
    for (let i = 0; i < iterations; i += 1) {
      const q = queries[i % queries.length];
      const t0 = performance.now();
      fuse.search(q);
      samples.push(performance.now() - t0);
    }

    const p95 = percentile(samples, 95);
    expect(p95).toBeLessThan(20);
  });
});
