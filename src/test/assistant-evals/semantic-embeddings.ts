// Token-level bag-of-words embedding provider for the eval bank. Each token
// maps to a SHA-256-derived direction in a 512-d space; doc/query vectors
// are the L2-normalized sum. Shared vocabulary → correlated vectors, so the
// vector channel carries real signal instead of hash noise like the default
// MockEmbeddingProvider (which hashes the full text as one opaque blob).

import { createHash } from "node:crypto";
import type {
  EmbeddingInputType,
  EmbeddingProvider,
} from "@/lib/services/assistant/embeddings.service";

const DIMENSION = 512;

// BoW without IDF is dominated by connector words ("de", "la", "the", "of")
// shared by every doc, which drags unrelated docs toward the query. Real
// Voyage doesn't have this weakness, so this list is a mock-specific
// compensation — not a production pipeline concern.
const STOPWORDS = new Set<string>([
  // ES
  "de",
  "del",
  "la",
  "las",
  "el",
  "los",
  "lo",
  "un",
  "una",
  "unos",
  "unas",
  "y",
  "o",
  "u",
  "a",
  "al",
  "en",
  "con",
  "por",
  "para",
  "sin",
  "sobre",
  "que",
  "se",
  "es",
  "mi",
  "tu",
  "su",
  "sus",
  "mis",
  "tus",
  "me",
  "te",
  "nos",
  "os",
  "les",
  "le",
  "si",
  "no",
  "hay",
  "ha",
  "he",
  "como",
  "cuando",
  "donde",
  "cual",
  "quien",
  "ya",
  "muy",
  "mas",
  "pero",
  "este",
  "esta",
  "esto",
  "ese",
  "esa",
  "eso",
  // EN
  "the",
  "an",
  "of",
  "in",
  "on",
  "at",
  "to",
  "for",
  "from",
  "by",
  "with",
  "and",
  "or",
  "but",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "will",
  "would",
  "can",
  "could",
  "should",
  "may",
  "might",
  "must",
  "shall",
  "what",
  "where",
  "when",
  "why",
  "how",
  "which",
  "who",
  "this",
  "that",
  "these",
  "those",
  "there",
  "here",
  "it",
  "i",
  "you",
  "he",
  "she",
  "we",
  "they",
  "my",
  "your",
  "his",
  "her",
  "our",
  "their",
  "me",
  "him",
  "them",
  "us",
  "any",
  "some",
  "all",
  "good",
  "if",
  "so",
  "as",
  "than",
  "then",
  "not",
]);

function tokenize(text: string): string[] {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

const tokenCache = new Map<string, Float32Array>();

function vectorForToken(token: string): Float32Array {
  const cached = tokenCache.get(token);
  if (cached) return cached;
  const out = new Float32Array(DIMENSION);
  let written = 0;
  let round = 0;
  while (written < DIMENSION) {
    const chunk = createHash("sha256")
      .update(token)
      .update(`:${round}`)
      .digest();
    for (let i = 0; i + 4 <= chunk.length && written < DIMENSION; i += 4) {
      const u = chunk.readUInt32BE(i);
      out[written] = (u / 0xffffffff) * 2 - 1;
      written += 1;
    }
    round += 1;
  }
  tokenCache.set(token, out);
  return out;
}

function embedText(text: string): number[] {
  const tokens = tokenize(text);
  const acc = new Float32Array(DIMENSION);
  if (tokens.length === 0) {
    // Degenerate input — return a stable non-zero vector so cosine is defined.
    acc[0] = 1;
    return Array.from(acc);
  }
  for (const tok of tokens) {
    const v = vectorForToken(tok);
    for (let i = 0; i < DIMENSION; i += 1) acc[i] += v[i];
  }
  let sumSq = 0;
  for (let i = 0; i < DIMENSION; i += 1) sumSq += acc[i] * acc[i];
  const norm = Math.sqrt(sumSq) || 1;
  const out = new Array<number>(DIMENSION);
  for (let i = 0; i < DIMENSION; i += 1) out[i] = acc[i] / norm;
  return out;
}

export class SemanticBowEmbeddingProvider implements EmbeddingProvider {
  readonly modelId = "mock:semantic-bow-v1";
  readonly dimension = DIMENSION;
  readonly version = 1;

  async embed(
    texts: string[],
    _opts: { inputType: EmbeddingInputType },
  ): Promise<number[][]> {
    return texts.map(embedText);
  }
}
