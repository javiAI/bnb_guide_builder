import { afterAll, beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { runEvalBank, type EvalReport } from "./runner";
import { formatMarkdown } from "./metrics";

const ACCURACY_GATE = 0.85;
const RECALL_AT_5_GATE = 0.9;

const ARTIFACT_DIR = process.env.EVAL_ARTIFACT_DIR ?? path.join(process.cwd(), "eval-artifacts");

let report: EvalReport;

describe("assistant eval bank (Rama 11E release gate)", () => {
  beforeAll(async () => {
    report = await runEvalBank();
    writeArtifacts(report);
  }, 120_000);

  afterAll(() => {
    if (report) {
      const { summary } = report;
      const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
      console.log(
        `[eval-bank] total=${summary.total} accuracy=${pct(summary.accuracy)} recall@5=${pct(
          summary.recallAt5,
        )} escalation=${pct(summary.escalationRate)} artifact=${ARTIFACT_DIR}`,
      );
    }
  });

  it("meets the accuracy gate", () => {
    expect(report.summary.accuracy).toBeGreaterThanOrEqual(ACCURACY_GATE);
  });

  it("meets the recall@5 gate", () => {
    expect(report.summary.recallAt5).toBeGreaterThanOrEqual(RECALL_AT_5_GATE);
  });

  it("covers the whole fixture bank without the harness crashing", () => {
    expect(report.summary.total).toBeGreaterThanOrEqual(50);
    expect(report.runs.length).toBe(report.summary.total);
    expect(report.scores.length).toBe(report.summary.total);
  });
});

function writeArtifacts(r: EvalReport): void {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(ARTIFACT_DIR, "eval-summary.json"),
    JSON.stringify({ summary: r.summary, scores: r.scores }, null, 2),
    "utf-8",
  );
  fs.writeFileSync(
    path.join(ARTIFACT_DIR, "eval-runs.json"),
    JSON.stringify({ runs: r.runs }, null, 2),
    "utf-8",
  );
  fs.writeFileSync(
    path.join(ARTIFACT_DIR, "eval-report.md"),
    formatMarkdown(r.summary, r.runs, r.scores),
    "utf-8",
  );
}
