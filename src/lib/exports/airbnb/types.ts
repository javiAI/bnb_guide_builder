import type { AirbnbListingPayload } from "@/lib/schemas/airbnb-listing";

export type ExportWarningCode =
  | "no_mapping"
  | "platform_not_supported"
  | "custom_value_unmapped"
  | "missing_pricing_currency"
  | "enum_value_passthrough"
  | "free_text_passthrough"
  | "schema_validation_failed";

export interface ExportWarning {
  code: ExportWarningCode;
  field?: string;
  taxonomyKey?: string;
  message: string;
}

export interface AirbnbExportResult {
  payload: AirbnbListingPayload;
  warnings: ExportWarning[];
  generatedAt: string;
  taxonomyVersion: string;
}
