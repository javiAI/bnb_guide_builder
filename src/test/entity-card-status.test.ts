/**
 * Canonical entity-card status vocabulary (16I-4).
 *
 * One icon+tone per state everywhere: check = done, dot = started,
 * dashed = nothing yet. Surfaces (Access configured/pending, Spaces
 * complete/partial/none) map onto these three and only provide copy.
 * This test pins the mapping AND that no pill consumer hand-picks circle
 * icons from lucide — the divergence this standardizes away (Spaces used a
 * full `Circle` for empty while Access used `CircleDashed`).
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { CircleCheck, CircleDashed, CircleDot } from "lucide-react";

import { ENTITY_CARD_STATUS_META } from "@/components/ui/entity-media-card";

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, acc);
    else if (full.endsWith(".tsx")) acc.push(full);
  }
  return acc;
}

describe("entity-card status vocabulary", () => {
  it("pins the canonical icon + tone per state", () => {
    expect(ENTITY_CARD_STATUS_META.complete).toEqual({ tone: "success", icon: CircleCheck });
    expect(ENTITY_CARD_STATUS_META.partial).toEqual({ tone: "warning", icon: CircleDot });
    expect(ENTITY_CARD_STATUS_META.empty).toEqual({ tone: "neutral", icon: CircleDashed });
  });

  it("no EntityCardStatusPill consumer hand-picks circle icons", () => {
    // The pill resolves icon+tone from META internally (it only accepts a
    // `status`), so the one remaining way to diverge is rendering circles
    // beside it — ban the circle family from consumer imports outright.
    const files = walk(join(process.cwd(), "src", "app")).filter((f) =>
      readFileSync(f, "utf8").includes("EntityCardStatusPill"),
    );
    expect(files.length).toBeGreaterThanOrEqual(2); // access + spaces today

    for (const file of files) {
      const src = readFileSync(file, "utf8");
      const lucideImport = src.match(/import\s*\{([^}]*)\}\s*from\s*"lucide-react"/)?.[1] ?? "";
      const banned = lucideImport
        .split(",")
        .map((s) => s.trim())
        .filter((name) => /^Circle(Check|Dot|Dashed)?$/.test(name));
      expect(banned, `${file} imports status circles directly: ${banned.join(", ")}`).toEqual([]);
    }
  });
});
