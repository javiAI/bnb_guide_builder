// Reranker.
//
// Cohere Rerank 3 multilingual (`rerank-multilingual-v3.0`). We call the
// REST endpoint directly rather than the SDK — one endpoint, explicit retry
// control, one less dependency to pin. Identity fallback (pass-through)
// activates when COHERE_API_KEY is absent in dev/test; production fails
// fast via `resolveReranker()`.

import type { RetrievedItem } from "./retriever";
import { retryWithBackoff } from "./_retry";

// ============================================================================
// Contract
// ============================================================================

export interface RerankedItem extends RetrievedItem {
  /**
   * Cohere's normalized relevance score in [0, 1]. For the identity reranker
   * this mirrors the input's `rrfScore` so downstream code can still sort
   * and threshold on `rerankScore` uniformly.
   */
  rerankScore: number;
}

export interface Reranker {
  readonly modelId: string;
  rerank(query: string, items: RetrievedItem[], topN: number): Promise<RerankedItem[]>;
}

// ============================================================================
// Constants
// ============================================================================

const COHERE_MODEL = "rerank-multilingual-v3.0";
const COHERE_ENDPOINT = "https://api.cohere.com/v2/rerank";

// ============================================================================
// Cohere reranker
// ============================================================================

interface CohereRerankResult {
  index: number;
  relevance_score: number;
}

interface CohereRerankResponse {
  results: CohereRerankResult[];
}

class CohereReranker implements Reranker {
  readonly modelId = `cohere:${COHERE_MODEL}`;

  constructor(private readonly apiKey: string) {}

  async rerank(
    query: string,
    items: RetrievedItem[],
    topN: number,
  ): Promise<RerankedItem[]> {
    if (items.length === 0) return [];

    // Rerank the concatenation of prefix + body — same signal the retriever
    // ranked against, so the reranker sees full context, not just topic.
    const documents = items.map((it) => `${it.contextPrefix}\n${it.bodyMd}`);

    const response = await retryWithBackoff(async () => {
      const res = await fetch(COHERE_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: COHERE_MODEL,
          query,
          documents,
          top_n: Math.min(topN, items.length),
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        const err = new Error(
          `Cohere rerank failed: ${res.status} ${res.statusText} ${body}`.trim(),
        );
        (err as Error & { status?: number }).status = res.status;
        throw err;
      }
      return (await res.json()) as CohereRerankResponse;
    });

    return response.results
      .filter((r) => Number.isInteger(r.index) && r.index >= 0 && r.index < items.length)
      .map((r) => ({ ...items[r.index], rerankScore: r.relevance_score }));
  }
}

// ============================================================================
// Identity reranker (dev/test fallback)
// ============================================================================

/**
 * Pass-through: keeps the retriever's RRF order and mirrors `rrfScore` into
 * `rerankScore` (scaled to roughly [0, 1] so the downstream 0.3 floor makes
 * sense against both channels). Production never sees this — see
 * `resolveReranker()`.
 */
class IdentityReranker implements Reranker {
  readonly modelId = "identity:passthrough";

  async rerank(
    _query: string,
    items: RetrievedItem[],
    topN: number,
  ): Promise<RerankedItem[]> {
    // RRF scores are tiny (~0.01 — 0.06 for RRF_K=60). Normalize against the
    // top score so the identity path produces [0, 1] values that still sort
    // stably. The 0.3 floor is semantic anyway — in dev it's essentially
    // disabled because the mock embedding channel is nonsensical.
    const top = items[0]?.rrfScore ?? 1;
    const scale = top > 0 ? 1 / top : 1;
    return items
      .slice(0, topN)
      .map((it) => ({ ...it, rerankScore: Math.min(1, it.rrfScore * scale) }));
  }
}

// ============================================================================
// Resolver
// ============================================================================

let cachedReranker: Reranker | null = null;
let cachedFingerprint: string | null = null;

/**
 * Pick the reranker for the current env.
 *
 * - Production (NODE_ENV=production): requires COHERE_API_KEY. Throws if
 *   absent. The identity fallback is dev/test only — in prod we would
 *   silently degrade the ranking quality, which is worse than failing fast.
 * - Dev/test: uses Cohere if the key is set; otherwise identity (with a
 *   one-shot warn so the developer knows they're not reranking).
 */
export function resolveReranker(): Reranker {
  if (cachedReranker && cachedFingerprint === "__test__") {
    return cachedReranker;
  }
  const fingerprint = `${process.env.NODE_ENV ?? ""}|${
    process.env.COHERE_API_KEY ? "key" : "no-key"
  }`;
  if (cachedReranker && cachedFingerprint === fingerprint) {
    return cachedReranker;
  }

  const apiKey = process.env.COHERE_API_KEY?.trim();
  const isProd = process.env.NODE_ENV === "production";

  if (apiKey) {
    cachedReranker = new CohereReranker(apiKey);
  } else if (isProd) {
    throw new Error(
      "COHERE_API_KEY is required in production. Identity reranker is dev/test only.",
    );
  } else {
    console.warn(
      "[assistant/reranker] COHERE_API_KEY not set — using identity pass-through (dev/test only).",
    );
    cachedReranker = new IdentityReranker();
  }
  cachedFingerprint = fingerprint;
  return cachedReranker;
}

/** Test escape hatch. Pass `null` to reset the cache. */
export function __setRerankerForTests(r: Reranker | null): void {
  cachedReranker = r;
  cachedFingerprint = r ? "__test__" : null;
}
