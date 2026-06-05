import beddingJson from "../../../taxonomies/bedding_options.json";

/** A single bedding option (mattress type / firmness / pillow type). */
export interface BeddingOption {
  id: string;
  label: string;
  /** Platform import mappings (reserved; empty today). */
  source?: unknown[];
}

interface BeddingOptionsFile {
  file: string;
  version: string;
  locale: string;
  units_system: string;
  description: string;
  mattressTypes: BeddingOption[];
  mattressFirmness: BeddingOption[];
  pillowTypes: BeddingOption[];
}

export const beddingOptions = beddingJson as BeddingOptionsFile;

export const mattressTypes = beddingOptions.mattressTypes;
export const mattressFirmness = beddingOptions.mattressFirmness;
export const pillowTypes = beddingOptions.pillowTypes;
