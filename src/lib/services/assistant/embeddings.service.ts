import { createHash } from "node:crypto";
import { retryWithBackoff } from "./_retry";

// Embeddings provider.
//
// Two providers behind one contract:
//   • VoyageEmbeddingProvider — real provider (voyage-3-lite, 512d).
//   • MockEmbeddingProvider — deterministic hash-based vectors for dev/test.
//
// `resolveEmbeddingProvider()` picks one based on env. Production requires
// VOYAGE_API_KEY and throws otherwise; dev/test falls back to the mock so the
// pipeline never crashes without a key. Mock removal is tracked in
// docs/FUTURE.md §14.

// ============================================================================
// Contract
// ============================================================================

export type EmbeddingInputType = "query" | "document";

export interface EmbeddingProvider {
  /**
   * Stable provider+model identifier persisted in
   * `knowledge_items.embedding_model`. Shape: `"<provider>:<model>"`.
   */
  readonly modelId: string;
  /** Output vector dimension. All providers emit 512-d vectors. */
  readonly dimension: number;
  /**
   * Bumps when the prefix strategy or model family changes semantically.
   * Persisted in `knowledge_items.embedding_version`; a mismatch triggers
   * re-embed during backfill (Rama 11C Fase 2).
   */
  readonly version: number;
  /**
   * Embed a batch. `inputType` steers the provider's encoding: `"query"` for
   * user questions, `"document"` for corpus items (prefixed KnowledgeItems).
   */
  embed(
    texts: string[],
    opts: { inputType: EmbeddingInputType },
  ): Promise<number[][]>;
}

// ============================================================================
// Constants
// ============================================================================

export const EMBEDDING_DIMENSION = 512;
export const EMBEDDING_VERSION = 1;

const VOYAGE_MODEL = "voyage-3-lite";
const VOYAGE_ENDPOINT = "https://api.voyageai.com/v1/embeddings";
// Voyage accepts up to 128 inputs per request for small-tier models; keep
// headroom for token caps (~1M tokens/batch). Caller-visible retries wrap
// each chunk.
const VOYAGE_MAX_BATCH = 128;

// ============================================================================
// Voyage provider
// ============================================================================

interface VoyageEmbeddingPayload {
  data: Array<{ embedding: number[]; index: number }>;
  model: string;
  usage: { total_tokens: number };
}

class VoyageEmbeddingProvider implements EmbeddingProvider {
  readonly modelId = `voyage:${VOYAGE_MODEL}`;
  readonly dimension = EMBEDDING_DIMENSION;
  readonly version = EMBEDDING_VERSION;

  constructor(private readonly apiKey: string) {}

  async embed(
    texts: string[],
    opts: { inputType: EmbeddingInputType },
  ): Promise<number[][]> {
    if (texts.length === 0) return [];

    const results: number[][] = new Array(texts.length);
    for (let start = 0; start < texts.length; start += VOYAGE_MAX_BATCH) {
      const chunk = texts.slice(start, start + VOYAGE_MAX_BATCH);
      const vectors = await this.embedChunk(chunk, opts.inputType);
      for (let j = 0; j < vectors.length; j += 1) {
        results[start + j] = vectors[j];
      }
    }
    return results;
  }

  private async embedChunk(
    chunk: string[],
    inputType: EmbeddingInputType,
  ): Promise<number[][]> {
    return retryWithBackoff(async () => {
      const res = await fetch(VOYAGE_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          input: chunk,
          model: VOYAGE_MODEL,
          input_type: inputType,
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        const err = new Error(
          `Voyage embed failed: ${res.status} ${res.statusText} ${body}`.trim(),
        );
        (err as Error & { status?: number }).status = res.status;
        throw err;
      }

      const payload = (await res.json()) as VoyageEmbeddingPayload;
      if (!Array.isArray(payload.data) || payload.data.length !== chunk.length) {
        throw new Error(
          `Voyage embed returned ${payload.data?.length ?? 0} vectors for ${chunk.length} inputs`,
        );
      }

      const sorted = [...payload.data].sort((a, b) => a.index - b.index);
      for (const item of sorted) {
        if (
          !Array.isArray(item.embedding) ||
          item.embedding.length !== EMBEDDING_DIMENSION
        ) {
          throw new Error(
            `Voyage embed returned dim=${item.embedding?.length}, expected ${EMBEDDING_DIMENSION}`,
          );
        }
      }
      return sorted.map((item) => item.embedding);
    });
  }
}

// ============================================================================
// Mock provider (dev/test only)
// ============================================================================

/**
 * Deterministic hash-based provider: SHA-256(text) expanded into a 512-d
 * L2-normalized vector. Same input always yields the same vector — stable
 * for fixtures and golden tests.
 *
 * Semantically meaningless: paraphrases produce unrelated vectors. Never used
 * in production (see resolveEmbeddingProvider). Retirement plan:
 * docs/FUTURE.md §14.
 */
class MockEmbeddingProvider implements EmbeddingProvider {
  readonly modelId = "mock:hash-v1";
  readonly dimension = EMBEDDING_DIMENSION;
  readonly version = EMBEDDING_VERSION;

  async embed(
    texts: string[],
    _opts: { inputType: EmbeddingInputType },
  ): Promise<number[][]> {
    return texts.map((text) => hashToVector(text, EMBEDDING_DIMENSION));
  }
}

function hashToVector(text: string, dim: number): number[] {
  const seed = createHash("sha256").update(text).digest();
  const floats = new Array<number>(dim);

  // Each SHA-256 round yields 32 bytes = 8 float32 slots. 512 / 8 = 64 rounds.
  let written = 0;
  let round = 0;
  while (written < dim) {
    const chunk = createHash("sha256")
      .update(seed)
      .update(`:${round}`)
      .digest();
    for (let i = 0; i + 4 <= chunk.length && written < dim; i += 4) {
      const u = chunk.readUInt32BE(i);
      floats[written] = (u / 0xffffffff) * 2 - 1; // → [-1, 1]
      written += 1;
    }
    round += 1;
  }

  // L2-normalize so cosine similarity is well-defined.
  let sumSq = 0;
  for (let i = 0; i < dim; i += 1) sumSq += floats[i] * floats[i];
  const norm = Math.sqrt(sumSq) || 1;
  for (let i = 0; i < dim; i += 1) floats[i] = floats[i] / norm;

  return floats;
}


// ============================================================================
// Resolver
// ============================================================================

let cachedProvider: EmbeddingProvider | null = null;
let cachedFingerprint: string | null = null;

/**
 * Pick the provider for the current env. Cached per-fingerprint so tests that
 * mutate env between calls get a fresh resolve, but the common case (prod,
 * long-lived process) hits the cache.
 *
 * - Production (NODE_ENV=production): requires VOYAGE_API_KEY. Throws if
 *   missing — we never silently fall back to the mock in prod.
 * - Dev/test: uses Voyage if the key is set; otherwise mock (with a one-shot
 *   warn so the developer knows they're on fake vectors).
 */
export function resolveEmbeddingProvider(): EmbeddingProvider {
  if (cachedProvider && cachedFingerprint === "__test__") {
    return cachedProvider;
  }
  const fingerprint = `${process.env.NODE_ENV ?? ""}|${
    process.env.VOYAGE_API_KEY ? "key" : "no-key"
  }`;
  if (cachedProvider && cachedFingerprint === fingerprint) {
    return cachedProvider;
  }

  const apiKey = process.env.VOYAGE_API_KEY?.trim();
  const isProd = process.env.NODE_ENV === "production";

  if (apiKey) {
    cachedProvider = new VoyageEmbeddingProvider(apiKey);
  } else if (isProd) {
    throw new Error(
      "VOYAGE_API_KEY is required in production. The deterministic mock is dev/test only. See docs/FUTURE.md §14.",
    );
  } else {
    console.warn(
      "[assistant/embeddings] VOYAGE_API_KEY not set — using deterministic hash-based mock (dev/test only).",
    );
    cachedProvider = new MockEmbeddingProvider();
  }

  cachedFingerprint = fingerprint;
  return cachedProvider;
}

/**
 * Pin a specific provider. Used by vitest fixtures to swap in a stub without
 * touching `process.env`. Pass `null` to reset cache.
 */
export function __setEmbeddingProviderForTests(
  provider: EmbeddingProvider | null,
): void {
  cachedProvider = provider;
  cachedFingerprint = provider ? "__test__" : null;
}
