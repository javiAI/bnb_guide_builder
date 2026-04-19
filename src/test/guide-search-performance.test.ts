import { describe, it, expect } from "vitest";
import { createFuseFromIndex } from "@/lib/client/guide-search-index";
import type {
  GuideSearchEntry,
  GuideSearchIndex,
} from "@/lib/types/guide-search-hit";

// Wall-clock assertions are flaky under CI load and shared runners. Gate
// the strict p95 check behind `RUN_PERF=1` so day-to-day CI only verifies
// the harness shape (no errors, index builds, search returns results);
// strict timing runs explicitly on local/perf pipelines. Matches the
// pattern other Node projects use for perf sanity checks.
const RUN_PERF_BUDGET = process.env.RUN_PERF === "1";
const P95_BUDGET_MS = 20;

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
  it("Fuse.search runs on a 200-entry index without errors", () => {
    // Non-timing smoke check — always on. Catches regressions that would
    // make Fuse throw or return nothing (wrong options, broken index
    // shape). The strict p95 budget lives below, gated on RUN_PERF=1.
    const fuse = createFuseFromIndex(synthIndex(200));
    const hits = fuse.search("wifi");
    expect(hits.length).toBeGreaterThan(0);
  });

  it.skipIf(!RUN_PERF_BUDGET)(
    `Fuse.search p95 stays under ${P95_BUDGET_MS}ms on a 200-entry index`,
    () => {
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
      expect(p95).toBeLessThan(P95_BUDGET_MS);
    },
  );
});
