// Unified warning vocabulary across platform exporters. Downstream consumers
// (UI, logs, tests) reason about all platforms with a single enum.

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

export class PropertyNotFoundError extends Error {
  constructor(propertyId: string) {
    super(`Property not found: ${propertyId}`);
    this.name = "PropertyNotFoundError";
  }
}
