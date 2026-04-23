import { z } from "zod";
import manifestJson from "../../../../taxonomies/platform-catalogs/booking-structured-fields.json";

const manifestEntrySchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("structured_field"),
    field: z.string().min(1),
    transform: z.enum(["bool", "currency", "minutes", "enum", "number"]),
    target_taxonomy: z.string().min(1),
    semantics: z.string().optional(),
    relevance: z.enum(["covered", "out_of_scope"]),
    reason: z.string().optional(),
  }),
  z.object({
    kind: z.literal("room_counter"),
    counter: z.enum(["bedrooms", "bathrooms", "beds"]),
    target_taxonomy: z.string().min(1),
    semantics: z.string().optional(),
    relevance: z.enum(["covered", "out_of_scope"]),
    reason: z.string().optional(),
  }),
  z.object({
    kind: z.literal("free_text"),
    field: z.string().min(1),
    target_taxonomy: z.string().min(1),
    semantics: z.string().optional(),
    relevance: z.enum(["covered", "out_of_scope"]),
    reason: z.string().optional(),
  }),
]);

const manifestFileSchema = z.object({
  pinned_at: z.string(),
  source_urls: z.array(z.string()),
  scope: z.string(),
  notes: z.string().optional(),
  entries: z.array(manifestEntrySchema),
});

export type BookingStructuredManifestEntry = z.infer<typeof manifestEntrySchema>;
export type BookingStructuredManifest = z.infer<typeof manifestFileSchema>;

export const bookingStructuredManifest: BookingStructuredManifest =
  manifestFileSchema.parse(manifestJson);

export const coveredManifestEntries: readonly BookingStructuredManifestEntry[] =
  bookingStructuredManifest.entries.filter((e) => e.relevance === "covered");
