import type { ItemTaxonomyFile } from "../types/taxonomy";
import automationChannelsJson from "../../../taxonomies/automation_channels.json";

export const automationChannels =
  automationChannelsJson as unknown as ItemTaxonomyFile;
