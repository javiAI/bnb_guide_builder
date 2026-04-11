import contactTypesJson from "../../taxonomies/contact_types.json";
import type { ContactTypesTaxonomyFile } from "./types/taxonomy";

export const contactTypes = contactTypesJson as unknown as ContactTypesTaxonomyFile;
