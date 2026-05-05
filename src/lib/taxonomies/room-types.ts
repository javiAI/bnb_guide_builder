import type { ItemTaxonomyFile } from "../types/taxonomy";
import roomTypesJson from "../../../taxonomies/room_types.json";

export const roomTypes = roomTypesJson as unknown as ItemTaxonomyFile;
