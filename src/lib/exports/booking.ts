import { resolvePropertyTypeCanonical as resolve } from "./shared/property-type-canonical";

export { serializeForBooking, buildBookingPayload } from "./booking/serialize";
export { PropertyNotFoundError } from "./shared/types";
export type { PropertyExportContext } from "./shared/load-property";
export type {
  BookingExportResult,
  ExportWarning,
  ExportWarningCode,
} from "./booking/types";

export const resolvePropertyTypeCanonical = (
  propertyTypeId: string | null | undefined,
) => resolve(propertyTypeId, "booking");
