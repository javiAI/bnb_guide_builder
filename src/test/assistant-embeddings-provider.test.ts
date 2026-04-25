import { describe, it, expect, afterEach, vi } from "vitest";
import {
  resolveEmbeddingProvider,
  EMBEDDING_DIMENSION,
  EMBEDDING_VERSION,
  __setEmbeddingProviderForTests,
} from "@/lib/services/assistant/embeddings.service";

describe("embeddings provider — mock fallback", () => {
  afterEach(() => {
    __setEmbeddingProviderForTests(null);
    vi.unstubAllEnvs();
  });

  it("returns deterministic L2-normalized 512-d vectors", async () => {
    __setEmbeddingProviderForTests(null);
    vi.stubEnv("VOYAGE_API_KEY", "");
    const provider = resolveEmbeddingProvider();
    expect(provider.modelId).toBe("mock:hash-v1");
    expect(provider.dimension).toBe(EMBEDDING_DIMENSION);
    expect(provider.version).toBe(EMBEDDING_VERSION);

    const [v1, v1b, v2] = await provider.embed(
      ["hola mundo", "hola mundo", "goodbye world"],
      { inputType: "document" },
    );
    expect(v1).toHaveLength(512);
    expect(v1).toEqual(v1b); // determinism
    expect(v1).not.toEqual(v2);

    const norm = Math.sqrt(v1.reduce((s, x) => s + x * x, 0));
    expect(norm).toBeGreaterThan(0.99);
    expect(norm).toBeLessThan(1.01);
  });

  it("throws in production if VOYAGE_API_KEY is missing", () => {
    __setEmbeddingProviderForTests(null);
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VOYAGE_API_KEY", "");
    expect(() => resolveEmbeddingProvider()).toThrow(/VOYAGE_API_KEY/);
  });

  it("resolves to Voyage provider when VOYAGE_API_KEY is set", () => {
    __setEmbeddingProviderForTests(null);
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("VOYAGE_API_KEY", "sk-voyage-fake");
    const provider = resolveEmbeddingProvider();
    expect(provider.modelId).toBe("voyage:voyage-3-lite");
  });
});
