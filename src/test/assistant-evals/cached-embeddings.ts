// Wraps a real EmbeddingProvider and memoises vectors to disk. Used only by
// the refresh script (EVAL_EMBED_REFRESH=1 VOYAGE_API_KEY=...), never by the
// CI gate — the gate is served by SemanticBowEmbeddingProvider directly.

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type {
  EmbeddingProvider,
  EmbeddingInputType,
} from "@/lib/services/assistant/embeddings.service";

export interface EmbeddingsCache {
  [sha256: string]: number[];
}

export interface CachedEmbeddingOpts {
  base: EmbeddingProvider;
  cachePath: string;
  refresh: boolean;
}

// Key is SHA-256 of the embedded text only — if the base provider changes,
// regenerate the cache file instead of salting the key.
export function keyFor(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

export function loadCache(cachePath: string): EmbeddingsCache {
  if (!fs.existsSync(cachePath)) return {};
  const raw = fs.readFileSync(cachePath, "utf-8");
  const trimmed = raw.trim();
  if (!trimmed) return {};
  return JSON.parse(trimmed) as EmbeddingsCache;
}

export function saveCache(cachePath: string, cache: EmbeddingsCache): void {
  fs.mkdirSync(path.dirname(cachePath), { recursive: true });
  const ordered: EmbeddingsCache = {};
  for (const k of Object.keys(cache).sort()) ordered[k] = cache[k];
  fs.writeFileSync(cachePath, `${JSON.stringify(ordered, null, 2)}\n`, "utf-8");
}

export class CachedEmbeddingProvider implements EmbeddingProvider {
  readonly modelId: string;
  readonly dimension: number;
  readonly version: number;

  private readonly cache: EmbeddingsCache;
  private dirty = false;

  constructor(private readonly opts: CachedEmbeddingOpts) {
    this.modelId = `${opts.base.modelId}+cache`;
    this.dimension = opts.base.dimension;
    this.version = opts.base.version;
    this.cache = loadCache(opts.cachePath);
  }

  async embed(
    texts: string[],
    ctx: { inputType: EmbeddingInputType },
  ): Promise<number[][]> {
    const out: number[][] = new Array(texts.length);
    const misses: { idx: number; text: string }[] = [];
    for (let i = 0; i < texts.length; i += 1) {
      const hit = this.cache[keyFor(texts[i])];
      if (hit) out[i] = hit;
      else misses.push({ idx: i, text: texts[i] });
    }
    if (misses.length > 0) {
      const missTexts = misses.map((m) => m.text);
      const vectors = await this.opts.base.embed(missTexts, ctx);
      for (let j = 0; j < misses.length; j += 1) {
        const { idx, text } = misses[j];
        const vec = vectors[j];
        out[idx] = vec;
        if (this.opts.refresh) {
          this.cache[keyFor(text)] = vec;
          this.dirty = true;
        }
      }
    }
    return out;
  }

  flush(): void {
    if (this.dirty) saveCache(this.opts.cachePath, this.cache);
    this.dirty = false;
  }
}
