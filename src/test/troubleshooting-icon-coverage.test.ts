/**
 * Icon-coverage contract for troubleshooting playbook types (mirror of
 * access-icon-coverage): Record keys === taxonomy ids, no silent fallbacks.
 */
import { describe, it, expect } from "vitest";
import { TROUBLESHOOTING_TYPE_ICONS } from "@/lib/icons/troubleshooting-icons";
import troubleshootingTaxonomy from "../../taxonomies/troubleshooting_taxonomy.json";

describe("troubleshooting icon coverage", () => {
  it("type icons match troubleshooting_taxonomy.json exactly", () => {
    const ids = (troubleshootingTaxonomy as unknown as { items: { id: string }[] }).items.map(
      (i) => i.id,
    );
    expect(Object.keys(TROUBLESHOOTING_TYPE_ICONS).sort()).toEqual(ids.sort());
  });
});
