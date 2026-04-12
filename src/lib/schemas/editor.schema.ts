import { z } from "zod";

// ── Property editor (replaces basics) ──

export const propertySchema = z.object({
  propertyNickname: z.string().min(1, "El nombre es obligatorio"),
  propertyType: z.string().min(1, "El tipo de propiedad es obligatorio"),
  roomType: z.string().min(1, "El tipo de espacio es obligatorio"),
  customPropertyTypeLabel: z.string().optional(),
  customPropertyTypeDesc: z.string().optional(),
  customRoomTypeLabel: z.string().optional(),
  customRoomTypeDesc: z.string().optional(),
  country: z.string().min(1, "El país es obligatorio"),
  city: z.string().min(1, "La ciudad es obligatoria"),
  region: z.string().optional(),
  postalCode: z.string().optional(),
  streetAddress: z.string().min(1, "La dirección es obligatoria"),
  addressExtra: z.string().nullable().optional(),
  addressLevel: z.string().optional(),
  timezone: z.string().min(1, "La zona horaria es obligatoria"),
  maxGuests: z.number().int().min(1, "Al menos 1 huésped"),
  maxAdults: z.number().int().min(1, "Al menos 1 adulto"),
  maxChildren: z.number().int().min(0),
  infantsAllowed: z.boolean(),
  bedroomsCount: z.number().int().min(0),
  bathroomsCount: z.number().int().min(1, "Al menos 1 baño"),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
}).refine(
  (d) => (d.latitude == null) === (d.longitude == null),
  { message: "Latitud y longitud deben proporcionarse juntas", path: ["latitude"] },
);

export type PropertyData = z.infer<typeof propertySchema>;

// ── Access editor (replaces arrival) ──

const accessLayerSchema = z.object({
  methods: z.array(z.string()),
  customLabel: z.string().nullable().optional(),
  customDesc: z.string().nullable().optional(),
});

export const accessSchema = z.object({
  checkInStart: z.string().min(1, "La hora de entrada es obligatoria"),
  checkInEnd: z.string().min(1, "La hora límite es obligatoria"),
  checkOutTime: z.string().min(1, "La hora de salida es obligatoria"),
  isAutonomousCheckin: z.boolean(),
  hasBuildingAccess: z.boolean(),
  buildingAccess: accessLayerSchema.optional(),
  unitAccess: accessLayerSchema.refine((d) => d.methods.length > 0, { message: "Selecciona al menos un método de acceso a la vivienda" }),
});

export type AccessData = z.infer<typeof accessSchema>;

// ── Contact schemas ──

export const createContactSchema = z.object({
  roleKey: z.string().min(1, "Selecciona un tipo de contacto"),
  entityType: z.string().min(1),
  displayName: z.string().min(1, "El nombre es obligatorio"),
  contactPersonName: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  phoneSecondary: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  whatsapp: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  availabilitySchedule: z.string().nullable().optional(),
  emergencyAvailable: z.boolean().optional(),
  hasPropertyAccess: z.boolean().optional(),
  internalNotes: z.string().nullable().optional(),
  guestVisibleNotes: z.string().nullable().optional(),
  visibility: z.string().optional(),
  isPrimary: z.boolean().optional(),
});

export const updateContactSchema = createContactSchema.partial().extend({
  displayName: z.string().min(1, "El nombre es obligatorio"),
});

// ── Policies editor ──

export const policiesSchema = z.object({
  quietHours: z.object({
    enabled: z.boolean(),
    from: z.string().optional(),
    to: z.string().optional(),
  }),
  smoking: z.enum(["not_allowed", "outdoors_only", "designated_area", "no_restriction"]),
  smokingArea: z.string().nullable().optional(),
  events: z.object({
    policy: z.enum(["not_allowed", "small_gatherings", "with_approval"]),
    maxPeople: z.number().int().min(1).optional(),
    approvalInstructions: z.string().nullable().optional(),
  }),
  commercialPhotography: z.enum(["not_allowed", "with_permission"]),
  pets: z.object({
    allowed: z.boolean(),
    types: z.array(z.string()).optional(),
    sizeRestriction: z.enum(["none", "small_only", "medium_max", "custom_weight"]).optional(),
    maxWeightKg: z.number().min(1).optional(),
    maxCount: z.number().int().min(1).max(10).optional(),
    feeMode: z.enum(["none", "per_booking", "per_night", "per_pet", "per_pet_per_night"]).optional(),
    feeAmount: z.number().min(0).optional(),
    restrictions: z.array(z.string()).optional(),
    notes: z.string().nullable().optional(),
  }),
  supplements: z.object({
    cleaning: z.object({ enabled: z.boolean(), amount: z.number().min(0).optional() }),
    extraGuest: z.object({ enabled: z.boolean(), amount: z.number().min(0).optional(), fromGuest: z.number().int().min(1).optional() }),
  }),
  services: z.object({
    allowed: z.boolean(),
    types: z.array(z.string()).optional(),
    notes: z.string().nullable().optional(),
  }),
});

export type PoliciesData = z.infer<typeof policiesSchema>;
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
