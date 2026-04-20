// Populates embeddings-cache.json with real Voyage vectors.
//   EVAL_EMBED_REFRESH=1 VOYAGE_API_KEY=... npm run eval:assistant:refresh
// The gate does not consume this file — it's an optional replay cache.

import fs from "node:fs";
import path from "node:path";

import { resolveEmbeddingProvider } from "@/lib/services/assistant/embeddings.service";
import { CachedEmbeddingProvider } from "@/test/assistant-evals/cached-embeddings";
import { EVAL_KNOWLEDGE_ITEMS } from "@/test/assistant-evals/knowledge-items-corpus";

const FIXTURES_PATH = path.join(
  __dirname,
  "..",
  "src",
  "test",
  "assistant-evals",
  "fixtures.json",
);
const CACHE_PATH = path.join(
  __dirname,
  "..",
  "src",
  "test",
  "assistant-evals",
  "embeddings-cache.json",
);

interface FixturesFile {
  fixtures: { question: string }[];
}

async function main(): Promise<void> {
  if (!process.env.VOYAGE_API_KEY) {
    console.error(
      "VOYAGE_API_KEY is required to refresh the eval embeddings cache. Without it the cache would fill with mock vectors and defeat the purpose.",
    );
    process.exit(1);
  }

  const base = resolveEmbeddingProvider();
  const cached = new CachedEmbeddingProvider({
    base,
    cachePath: CACHE_PATH,
    refresh: true,
  });

  const docTexts = EVAL_KNOWLEDGE_ITEMS.map(
    (item) => `${item.contextPrefix}\n${item.bodyMd}`,
  );
  await cached.embed(docTexts, { inputType: "document" });

  const fixtures = JSON.parse(
    fs.readFileSync(FIXTURES_PATH, "utf-8"),
  ) as FixturesFile;
  const queryTexts = fixtures.fixtures.map((f) => f.question);
  await cached.embed(queryTexts, { inputType: "query" });

  cached.flush();
  console.log(
    `Wrote ${docTexts.length + queryTexts.length} embeddings to ${CACHE_PATH}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
