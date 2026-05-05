import type {
  PolicyGroupedFile,
  PolicyGroup,
  PolicyItemField,
  TaxonomyItem,
  TaxonomyOption,
} from "../types/taxonomy";
import policyTaxonomyJson from "../../../taxonomies/policy_taxonomy.json";

export const policyTaxonomy =
  policyTaxonomyJson as unknown as PolicyGroupedFile;

export function getPolicyGroups(taxonomy: PolicyGroupedFile): PolicyGroup[] {
  return taxonomy.groups;
}

export function getPolicyItems(taxonomy: PolicyGroupedFile): TaxonomyItem[] {
  return taxonomy.groups.flatMap((g) => g.items);
}

const POLICY_ITEM_BY_ID: ReadonlyMap<string, TaxonomyItem> = new Map(
  getPolicyItems(policyTaxonomy).map((i) => [i.id, i]),
);

export function findPolicyItem(itemId: string): TaxonomyItem | undefined {
  return POLICY_ITEM_BY_ID.get(itemId);
}

export function getPolicyOptions(itemId: string): TaxonomyOption[] {
  return findPolicyItem(itemId)?.options ?? [];
}

export function getPolicyFieldOptions(
  itemId: string,
  fieldId: string,
): TaxonomyOption[] {
  const item = findPolicyItem(itemId);
  if (!item?.fields) return [];
  const field = item.fields.find((f: PolicyItemField) => f.id === fieldId);
  return field?.options ?? [];
}
