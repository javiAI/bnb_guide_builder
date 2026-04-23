import type { BookingListingPayload } from "@/lib/schemas/booking-listing";
import type { ExportWarning } from "../shared/types";

export type {
  ExportWarning,
  ExportWarningCode,
} from "../shared/types";

export interface BookingExportResult {
  payload: BookingListingPayload;
  warnings: ExportWarning[];
  generatedAt: string;
  taxonomyVersion: string;
}
