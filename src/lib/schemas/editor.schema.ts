import { z } from "zod";

// ── Basics editor (S-09) ──

export const basicsSchema = z.object({
  propertyNickname: z.string().min(1, "El nombre es obligatorio"),
  propertyType: z.string().min(1, "El tipo de propiedad es obligatorio"),
  roomType: z.string().min(1, "El tipo de espacio es obligatorio"),
  country: z.string().min(1, "El país es obligatorio"),
  city: z.string().min(1, "La ciudad es obligatoria"),
  region: z.string().optional(),
  postalCode: z.string().optional(),
  streetAddress: z.string().optional(),
  addressLevel: z.string().optional(),
  timezone: z.string().min(1, "La zona horaria es obligatoria"),
  maxGuests: z.number().int().min(1, "Al menos 1 huésped"),
  bedroomsCount: z.number().int().min(0),
  bedsCount: z.number().int().min(1, "Al menos 1 cama"),
  bathroomsCount: z.number().int().min(1, "Al menos 1 baño"),
});

export type BasicsData = z.infer<typeof basicsSchema>;

// ── Arrival editor (S-10) ──

export const arrivalSchema = z.object({
  checkInStart: z.string().min(1, "La hora de entrada es obligatoria"),
  checkInEnd: z.string().min(1, "La hora límite es obligatoria"),
  checkOutTime: z.string().min(1, "La hora de salida es obligatoria"),
  primaryAccessMethod: z.string().min(1, "El método de acceso es obligatorio"),
  hostContactPhone: z.string().optional(),
  supportContact: z.string().optional(),
});

export type ArrivalData = z.infer<typeof arrivalSchema>;

// ── Policies editor (S-11) ──
// Policy data is stored as JSONB in a flexible structure
// since policy items have varying types (enum, number, object, etc.)

export const policyValueSchema = z.record(
  z.string(),
  z.union([z.string(), z.number(), z.boolean(), z.null()]),
);

export type PolicyValues = z.infer<typeof policyValueSchema>;

// ── Spaces (S-12, S-13) ──

export const createSpaceSchema = z.object({
  spaceType: z.string().min(1, "El tipo de espacio es obligatorio"),
  name: z.string().min(1, "El nombre es obligatorio"),
  guestNotes: z.string().optional(),
  internalNotes: z.string().optional(),
});

export const updateSpaceSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio"),
  guestNotes: z.string().optional(),
  aiNotes: z.string().optional(),
  internalNotes: z.string().optional(),
  visibility: z.string().optional(),
  sortOrder: z.number().int().optional(),
});

export type CreateSpaceData = z.infer<typeof createSpaceSchema>;
export type UpdateSpaceData = z.infer<typeof updateSpaceSchema>;

// ── Amenities (S-14, S-15) ──

export const toggleAmenitySchema = z.object({
  amenityKey: z.string().min(1),
  enabled: z.boolean(),
});

export const updateAmenitySchema = z.object({
  subtypeKey: z.string().optional(),
  guestInstructions: z.string().optional(),
  aiInstructions: z.string().optional(),
  internalNotes: z.string().optional(),
  troubleshootingNotes: z.string().optional(),
  visibility: z.string().optional(),
});

export type ToggleAmenityData = z.infer<typeof toggleAmenitySchema>;
export type UpdateAmenityData = z.infer<typeof updateAmenitySchema>;

// ── Troubleshooting (S-16, S-17) ──

export const createPlaybookSchema = z.object({
  playbookKey: z.string().min(1, "El tipo de incidencia es obligatorio"),
  title: z.string().min(1, "El título es obligatorio"),
  severity: z.string().optional(),
});

export const updatePlaybookSchema = z.object({
  title: z.string().min(1, "El título es obligatorio"),
  severity: z.string().optional(),
  symptomsMd: z.string().optional(),
  guestStepsMd: z.string().optional(),
  internalStepsMd: z.string().optional(),
  escalationRule: z.string().optional(),
  visibility: z.string().optional(),
});

export type CreatePlaybookData = z.infer<typeof createPlaybookSchema>;
export type UpdatePlaybookData = z.infer<typeof updatePlaybookSchema>;

// ── Local Guide (S-18) ──

export const createLocalPlaceSchema = z.object({
  categoryKey: z.string().min(1, "La categoría es obligatoria"),
  name: z.string().min(1, "El nombre es obligatorio"),
  shortNote: z.string().optional(),
  distanceMeters: z.number().int().min(0).optional(),
});

export const updateLocalPlaceSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio"),
  shortNote: z.string().optional(),
  guestDescription: z.string().optional(),
  aiNotes: z.string().optional(),
  distanceMeters: z.number().int().min(0).optional(),
  hoursText: z.string().optional(),
  linkUrl: z.string().optional(),
  bestFor: z.string().optional(),
  seasonalNotes: z.string().optional(),
  visibility: z.string().optional(),
});

export type CreateLocalPlaceData = z.infer<typeof createLocalPlaceSchema>;
export type UpdateLocalPlaceData = z.infer<typeof updateLocalPlaceSchema>;

// ── Media (upload flow) ──

export const createMediaAssetSchema = z.object({
  assetRoleKey: z.string().min(1, "El rol del asset es obligatorio"),
  mediaType: z.string().min(1, "El tipo de media es obligatorio"),
  caption: z.string().optional(),
  visibility: z.string().optional(),
});

export const assignMediaSchema = z.object({
  mediaAssetId: z.string().min(1),
  entityType: z.string().min(1),
  entityId: z.string().min(1),
  usageKey: z.string().optional(),
});

export type CreateMediaAssetData = z.infer<typeof createMediaAssetSchema>;
export type AssignMediaData = z.infer<typeof assignMediaSchema>;
