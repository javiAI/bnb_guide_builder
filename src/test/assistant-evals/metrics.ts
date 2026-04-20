// Accuracy = every expected fact substring must appear in the synthesized
// answer (case-insensitive). Recall@5 = |expected ∩ cited_top_5| / |expected|;
// extras don't penalize — the pipeline already caps reranked output at 5.

export interface FixtureRun {
  id: string;
  propertyId: string;
  language: string;
  question: string;
  expectedItemIds: string[];
  expectedFacts: string[];
  journeyStage?: string | null;
  chunkType?: string | null;
  // Pipeline outcome
  answer: string;
  citedItemIds: string[];
  escalated: boolean;
  escalationReason: string | null;
}

export interface FixtureScore {
  id: string;
  accuracyPass: boolean;
  recallAt5: number;
  missingFacts: string[];
  missingCitations: string[];
  escalated: boolean;
}

export interface EvalSummary {
  total: number;
  accuracy: number;
  recallAt5: number;
  escalationRate: number;
  breakdowns: {
    byLanguage: Record<string, { total: number; accuracy: number; recallAt5: number }>;
    byJourneyStage: Record<string, { total: number; accuracy: number; recallAt5: number }>;
    byChunkType: Record<string, { total: number; accuracy: number; recallAt5: number }>;
  };
}

export function scoreFixture(run: FixtureRun): FixtureScore {
  const answerLc = run.answer.toLowerCase();
  const missingFacts = run.expectedFacts.filter(
    (fact) => !answerLc.includes(fact.toLowerCase()),
  );
  const accuracyPass = !run.escalated && missingFacts.length === 0;

  const citedSet = new Set(run.citedItemIds);
  const hits = run.expectedItemIds.filter((id) => citedSet.has(id));
  const recallAt5 =
    run.expectedItemIds.length === 0 ? 1 : hits.length / run.expectedItemIds.length;
  const missingCitations = run.expectedItemIds.filter((id) => !citedSet.has(id));

  return {
    id: run.id,
    accuracyPass,
    recallAt5,
    missingFacts,
    missingCitations,
    escalated: run.escalated,
  };
}

export function summarise(
  runs: FixtureRun[],
  scores: FixtureScore[],
): EvalSummary {
  const total = runs.length;
  const accuracy = total === 0 ? 0 : scores.filter((s) => s.accuracyPass).length / total;
  const recallAt5 =
    total === 0 ? 0 : scores.reduce((sum, s) => sum + s.recallAt5, 0) / total;
  const escalationRate =
    total === 0 ? 0 : scores.filter((s) => s.escalated).length / total;

  const groupBy = (
    getKey: (r: FixtureRun) => string | null | undefined,
  ): Record<string, { total: number; accuracy: number; recallAt5: number }> => {
    const buckets = new Map<string, { total: number; pass: number; recall: number }>();
    for (let i = 0; i < runs.length; i += 1) {
      const key = getKey(runs[i]) ?? "unknown";
      const b = buckets.get(key) ?? { total: 0, pass: 0, recall: 0 };
      b.total += 1;
      if (scores[i].accuracyPass) b.pass += 1;
      b.recall += scores[i].recallAt5;
      buckets.set(key, b);
    }
    const out: Record<string, { total: number; accuracy: number; recallAt5: number }> = {};
    for (const [key, { total: t, pass, recall }] of buckets) {
      out[key] = { total: t, accuracy: pass / t, recallAt5: recall / t };
    }
    return out;
  };

  return {
    total,
    accuracy,
    recallAt5,
    escalationRate,
    breakdowns: {
      byLanguage: groupBy((r) => r.language),
      byJourneyStage: groupBy((r) => r.journeyStage),
      byChunkType: groupBy((r) => r.chunkType),
    },
  };
}

export function formatMarkdown(
  summary: EvalSummary,
  runs: FixtureRun[],
  scores: FixtureScore[],
): string {
  const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
  const lines: string[] = [];
  lines.push(`# Assistant eval bank report`);
  lines.push(``);
  lines.push(`| Metric | Value |`);
  lines.push(`| --- | --- |`);
  lines.push(`| Fixtures | ${summary.total} |`);
  lines.push(`| Accuracy (answer-facts-match) | ${pct(summary.accuracy)} |`);
  lines.push(`| Recall@5 (citations) | ${pct(summary.recallAt5)} |`);
  lines.push(`| Escalation rate | ${pct(summary.escalationRate)} |`);
  lines.push(``);

  const section = (
    title: string,
    rows: Record<string, { total: number; accuracy: number; recallAt5: number }>,
  ) => {
    lines.push(`## ${title}`);
    lines.push(``);
    lines.push(`| Bucket | Total | Accuracy | Recall@5 |`);
    lines.push(`| --- | ---: | ---: | ---: |`);
    for (const key of Object.keys(rows).sort()) {
      const r = rows[key];
      lines.push(`| ${key} | ${r.total} | ${pct(r.accuracy)} | ${pct(r.recallAt5)} |`);
    }
    lines.push(``);
  };
  section("By language", summary.breakdowns.byLanguage);
  section("By journey stage", summary.breakdowns.byJourneyStage);
  section("By chunk type", summary.breakdowns.byChunkType);

  const failures = scores.filter((s) => !s.accuracyPass || s.recallAt5 < 1);
  if (failures.length > 0) {
    lines.push(`## Failures (${failures.length})`);
    lines.push(``);
    lines.push(`| Fixture | Accuracy | Recall@5 | Missing facts | Missing citations |`);
    lines.push(`| --- | :---: | ---: | --- | --- |`);
    for (const s of failures) {
      const run = runs.find((r) => r.id === s.id)!;
      const mark = s.accuracyPass ? "✓" : s.escalated ? "⚠️ escalated" : "✗";
      lines.push(
        `| \`${run.id}\` | ${mark} | ${pct(s.recallAt5)} | ${
          s.missingFacts.join(", ") || "—"
        } | ${s.missingCitations.join(", ") || "—"} |`,
      );
    }
    lines.push(``);
  }

  return lines.join("\n");
}
