import type { GuideTree } from "@/lib/types/guide-tree";
import { buildAdversarialTree } from "@/test/fixtures/adversarial-property";
import { buildEmptyTree } from "./empty-tree";
import { buildRichTree } from "./rich-tree";

export interface E2EFixture {
  tree: GuideTree;
  propertyTitle: string;
}

/** Catalog of E2E fixtures available under `/g/e2e/[fixture]`. Specs and
 * the server route share this list so spec-side iteration matches what the
 * server can resolve. */
export const E2E_FIXTURES = ["empty", "rich", "adversarial"] as const;
export type E2EFixtureName = (typeof E2E_FIXTURES)[number];

export function isE2EFixtureName(name: string): name is E2EFixtureName {
  return (E2E_FIXTURES as ReadonlyArray<string>).includes(name);
}

export function getE2EFixture(name: string): E2EFixture | null {
  if (!isE2EFixtureName(name)) return null;
  switch (name) {
    case "empty":
      return { tree: buildEmptyTree(), propertyTitle: "Apartamento de prueba (vacío)" };
    case "rich":
      return { tree: buildRichTree(), propertyTitle: "Apartamento Casa Claudia" };
    case "adversarial":
      return { tree: buildAdversarialTree(), propertyTitle: "Fixture adversarial" };
  }
}
