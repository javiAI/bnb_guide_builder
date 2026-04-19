// Escalation intent resolver.
//
// Pure, deterministic, no LLM. Maps an unanswered question (+ optional
// `escalationReason` from the synthesizer) to one of the `int.*` intents
// declared in `taxonomies/escalation_rules.json`. The pipeline uses the
// resulting intent to pick which contact role(s) to hand the guest off to
// in `escalation.service.ts`.
//
// Why keyword-based (not LLM): routing a guest to "locksmith" vs. "host"
// must be auditable, testable, and config-driven. An operator adding
// `"perdí la llave maestra"` to `int.lockout.matchKeywords.es` must see
// the effect on the next ask() without redeploying prompts. A Haiku
// classifier layer may be added later (see §11D Commit 4) but only if
// precision on the critical intents falls below the gate.

import {
  getEscalationFallback,
  getEscalationIntents,
  type EscalationIntent,
  type EscalationIntentId,
} from "@/lib/taxonomy-loader";

// ============================================================================
// Contract
// ============================================================================

export interface ResolveEscalationIntentInput {
  question: string;
  language: "es" | "en";
  /** Optional free-text reason emitted by the synthesizer when it chose to
   *  escalate (e.g. "question requires a plumber, out of scope"). Pooled
   *  with the question as matching text so synthesizer hints don't get
   *  ignored when the guest's own words are too vague. */
  escalationReason?: string | null;
}

export interface EscalationIntentMatch {
  intentId: EscalationIntentId;
  /** [0, 1]. Emergency matches > non-emergency matches > fallback. */
  confidence: number;
  /** The keyword that triggered the match, or `null` when we fell back to
   *  `int.general` because no keyword hit. */
  matchedKeyword: string | null;
}

// ============================================================================
// Confidence tiers
// ============================================================================

const CONFIDENCE = {
  emergency: 0.9,
  nonEmergency: 0.75,
  fallback: 0.25,
} as const;

// ============================================================================
// Matching
// ============================================================================

/** Lowercase + strip combining diacritics so "médica" matches "medica". */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

interface Candidate {
  intent: EscalationIntent;
  matchedKeyword: string;
}

/** Pick the best candidate across all intents.
 *  Priority: emergency > non-emergency; within the same tier, the candidate
 *  whose matched keyword is longest wins (more specific match). */
function pickBest(candidates: Candidate[]): Candidate | null {
  if (candidates.length === 0) return null;
  return candidates.reduce((best, c) => {
    if (!best) return c;
    const bestEmerg = best.intent.emergencyPriority ? 1 : 0;
    const cEmerg = c.intent.emergencyPriority ? 1 : 0;
    if (cEmerg !== bestEmerg) return cEmerg > bestEmerg ? c : best;
    return c.matchedKeyword.length > best.matchedKeyword.length ? c : best;
  });
}

// ============================================================================
// Public API
// ============================================================================

export function resolveEscalationIntent(
  input: ResolveEscalationIntentInput,
): EscalationIntentMatch {
  const fallback = getEscalationFallback();
  const haystack = normalize(`${input.question}\n${input.escalationReason ?? ""}`);
  if (haystack.trim().length === 0) {
    return {
      intentId: fallback.intentId as EscalationIntentId,
      confidence: CONFIDENCE.fallback,
      matchedKeyword: null,
    };
  }

  const candidates: Candidate[] = [];
  for (const intent of getEscalationIntents()) {
    // `int.general` declares no keywords — it's the fallback bucket.
    const keywords = intent.matchKeywords[input.language];
    if (keywords.length === 0) continue;
    let longest: string | null = null;
    for (const kw of keywords) {
      if (haystack.includes(normalize(kw)) && (!longest || kw.length > longest.length)) {
        longest = kw;
      }
    }
    if (longest !== null) candidates.push({ intent, matchedKeyword: longest });
  }

  const best = pickBest(candidates);
  if (!best) {
    return {
      intentId: fallback.intentId as EscalationIntentId,
      confidence: CONFIDENCE.fallback,
      matchedKeyword: null,
    };
  }

  return {
    intentId: best.intent.id,
    confidence: best.intent.emergencyPriority
      ? CONFIDENCE.emergency
      : CONFIDENCE.nonEmergency,
    matchedKeyword: best.matchedKeyword,
  };
}

export const __internal = { normalize, CONFIDENCE };
