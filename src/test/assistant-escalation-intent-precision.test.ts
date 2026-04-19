// Precision gate for the heuristic escalation intent resolver (Rama 11D §4).
//
// Runs the full labeled corpus through resolveEscalationIntent() and
// computes per-intent precision = (correctly predicted as X) / (predicted as X).
// Critical intents must clear PRECISION_THRESHOLD; a regression in the
// taxonomy keywords (e.g. adding a vague substring that over-captures) is
// supposed to trip this test loudly before it ships.
//
// If this gate starts failing and adding/removing keywords can't bring it
// back under the threshold, that's the signal to layer in a Haiku classifier
// (see docs/FEATURES/KNOWLEDGE_GUIDE_ASSISTANT.md §Escalation routing).

import { describe, expect, it } from "vitest";
import { resolveEscalationIntent } from "@/lib/services/assistant/escalation-intent";
import type { EscalationIntentId } from "@/lib/taxonomy-loader";
import {
  CRITICAL_INTENTS,
  ESCALATION_CORPUS,
  PRECISION_THRESHOLD,
} from "./fixtures/escalation-intent-corpus";

interface IntentStats {
  predicted: number;
  correct: number;
  /** Recall-style: how many ground-truth examples we got right. */
  expected: number;
  recalled: number;
}

function runCorpus(): Map<EscalationIntentId, IntentStats> {
  const stats = new Map<EscalationIntentId, IntentStats>();
  const bump = (id: EscalationIntentId): IntentStats => {
    const existing = stats.get(id);
    if (existing) return existing;
    const fresh = { predicted: 0, correct: 0, expected: 0, recalled: 0 };
    stats.set(id, fresh);
    return fresh;
  };
  for (const row of ESCALATION_CORPUS) {
    const result = resolveEscalationIntent({
      question: row.question,
      language: row.language,
      escalationReason: row.escalationReason,
    });
    const expected = bump(row.expectedIntent);
    const predicted = bump(result.intentId);
    expected.expected += 1;
    predicted.predicted += 1;
    if (result.intentId === row.expectedIntent) {
      predicted.correct += 1;
      expected.recalled += 1;
    }
  }
  return stats;
}

describe("escalation intent — precision gate", () => {
  const stats = runCorpus();

  it.each(CRITICAL_INTENTS)("%s clears the precision threshold", (intent) => {
    const row = stats.get(intent);
    expect(row, `no predictions for ${intent}`).toBeDefined();
    // Precision is undefined when predicted=0, but every critical intent
    // must be predicted at least once in the corpus — that's a design
    // invariant. If a critical intent has 0 predictions, the corpus has a
    // hole (missing positive examples), which is itself a failure.
    expect(row!.predicted, `${intent} has no predictions in corpus`).toBeGreaterThan(0);
    const precision = row!.correct / row!.predicted;
    expect(precision).toBeGreaterThanOrEqual(PRECISION_THRESHOLD);
  });

  it.each(CRITICAL_INTENTS)("%s has full recall on the labeled corpus", (intent) => {
    // Recall matters as much as precision for critical intents: missing a
    // true medical emergency (routing it to int.general) is the worst
    // failure mode. We require 100% recall on the corpus because the
    // corpus rows are the ones we've already decided SHOULD match.
    const row = stats.get(intent);
    expect(row, `no expected rows for ${intent}`).toBeDefined();
    expect(row!.expected, `${intent} has no labeled examples`).toBeGreaterThan(0);
    const recall = row!.recalled / row!.expected;
    expect(recall).toBe(1);
  });

  it("corpus has ≥5 labeled rows per critical intent (statistical floor)", () => {
    // Precision computed on a 2-row slice is meaningless. This guards
    // against someone trimming the corpus below a useful size.
    for (const intent of CRITICAL_INTENTS) {
      const row = stats.get(intent);
      expect(
        row?.expected ?? 0,
        `${intent} has fewer than 5 labeled examples`,
      ).toBeGreaterThanOrEqual(5);
    }
  });
});
