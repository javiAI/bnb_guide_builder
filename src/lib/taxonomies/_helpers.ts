import type { ItemTaxonomyFile, TaxonomyItem } from "../types/taxonomy";

export function getItems(taxonomy: ItemTaxonomyFile): TaxonomyItem[] {
  return taxonomy.items;
}

export function findItem(
  taxonomy: ItemTaxonomyFile,
  id: string,
): TaxonomyItem | undefined {
  return taxonomy.items.find((item) => item.id === id);
}

export function getRecommendedItems(taxonomy: ItemTaxonomyFile): TaxonomyItem[] {
  return taxonomy.items.filter((item) => item.recommended);
}
