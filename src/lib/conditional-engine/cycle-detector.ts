/**
 * Detect cycles in `requiresAmenities` / `requiresSystems` / `requiresSpaces`
 * relationships across a catalog of rules.  Called by bundle validators so a
 * circular dependency fails the build instead of surfacing at runtime.
 */

import type { ItemRules } from "./types";

type RequiresKey = "requiresAmenities" | "requiresSystems" | "requiresSpaces";

export type CatalogEntry = {
  id: string;
  rules?: ItemRules | null;
};

function collectRequires(rules: ItemRules | null | undefined, key: RequiresKey): string[] {
  if (!rules) return [];
  const out: string[] = [];
  if (rules[key]) out.push(...(rules[key] as string[]));
  rules.allOf?.forEach((b) => out.push(...collectRequires(b, key)));
  rules.anyOf?.forEach((b) => out.push(...collectRequires(b, key)));
  // `not` is deliberately skipped: negation of a requirement is not a dep.
  return out;
}

/**
 * Returns a list of cycles, each expressed as the path of IDs that form it.
 * Empty array → no cycles.
 */
export function detectCycles(catalog: CatalogEntry[], key: RequiresKey): string[][] {
  const graph = new Map<string, string[]>();
  for (const entry of catalog) {
    graph.set(entry.id, collectRequires(entry.rules, key));
  }

  const cycles: string[][] = [];
  const visited = new Set<string>();
  const stack = new Set<string>();
  const path: string[] = [];

  function dfs(node: string) {
    if (stack.has(node)) {
      const start = path.indexOf(node);
      cycles.push([...path.slice(start), node]);
      return;
    }
    if (visited.has(node)) return;

    visited.add(node);
    stack.add(node);
    path.push(node);

    for (const neighbour of graph.get(node) ?? []) {
      if (graph.has(neighbour)) dfs(neighbour);
    }

    stack.delete(node);
    path.pop();
  }

  for (const id of graph.keys()) dfs(id);

  return cycles;
}

export function assertNoCycles(catalog: CatalogEntry[], key: RequiresKey): void {
  const cycles = detectCycles(catalog, key);
  if (cycles.length > 0) {
    const rendered = cycles.map((c) => c.join(" → ")).join("; ");
    throw new Error(`Cycle detected in ${key}: ${rendered}`);
  }
}
