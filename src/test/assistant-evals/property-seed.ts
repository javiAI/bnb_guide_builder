import { prisma } from "@/lib/db";
import { resolveEmbeddingProvider } from "@/lib/services/assistant/embeddings.service";
import { toVectorLiteral } from "@/lib/services/assistant/retriever";
import {
  EVAL_KNOWLEDGE_ITEMS,
  EVAL_PROPERTIES,
  EVAL_PROPERTY_EN,
  EVAL_PROPERTY_ES,
  EVAL_WORKSPACE_ID,
  type EvalKnowledgeItem,
} from "./knowledge-items-corpus";

export async function seedEvalFixtures(): Promise<void> {
  await teardownEvalFixtures();

  await prisma.workspace.create({
    data: {
      id: EVAL_WORKSPACE_ID,
      name: "Eval workspace (assistant bank)",
    },
  });

  await Promise.all(
    EVAL_PROPERTIES.map((prop) =>
      prisma.property.create({
        data: {
          id: prop.id,
          workspaceId: prop.workspaceId,
          propertyNickname: prop.propertyNickname,
          defaultLocale: prop.defaultLocale,
          country: prop.country,
          city: prop.city,
          timezone: prop.timezone,
        },
      }),
    ),
  );

  await prisma.knowledgeItem.createMany({
    data: EVAL_KNOWLEDGE_ITEMS.map((item) => ({
      id: item.id,
      propertyId: item.propertyId,
      topic: item.topic,
      bodyMd: item.bodyMd,
      locale: item.locale,
      visibility: item.visibility,
      journeyStage: item.journeyStage,
      chunkType: item.chunkType,
      entityType: item.entityType,
      contextPrefix: item.contextPrefix,
      canonicalQuestion: item.canonicalQuestion,
      bm25Text: item.bm25Text,
      tags: item.tags,
      confidenceScore: 0.9,
    })),
  });

  await embedEvalItems(EVAL_KNOWLEDGE_ITEMS);
}

export async function teardownEvalFixtures(): Promise<void> {
  await prisma.$executeRaw`DELETE FROM "knowledge_items" WHERE "property_id" IN (${EVAL_PROPERTY_ES}, ${EVAL_PROPERTY_EN})`;
  await prisma.property.deleteMany({
    where: { id: { in: [EVAL_PROPERTY_ES, EVAL_PROPERTY_EN] } },
  });
  await prisma.workspace.deleteMany({ where: { id: EVAL_WORKSPACE_ID } });
}

async function embedEvalItems(items: readonly EvalKnowledgeItem[]): Promise<void> {
  const provider = resolveEmbeddingProvider();
  const texts = items.map((it) => `${it.contextPrefix}\n${it.bodyMd}`);
  const vectors = await provider.embed(texts, { inputType: "document" });

  const ids = items.map((it) => it.id);
  const lits = vectors.map(toVectorLiteral);
  await prisma.$executeRaw`
    UPDATE "knowledge_items" AS k
    SET "embedding" = v.embedding::vector,
        "embedding_model" = ${provider.modelId},
        "embedding_version" = ${provider.version}
    FROM unnest(${ids}::text[], ${lits}::text[]) AS v(id, embedding)
    WHERE k.id = v.id
  `;
}
