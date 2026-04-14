import { z } from "zod";

// ── Property editor (replaces basics) ──

export const propertySchema = z.object({
  propertyNickname: z.string().min(1, "El nombre es obligatorio"),
  propertyType: z.string().min(1, "El tipo de propiedad es obligatorio"),
  roomType: z.string().min(1, "El tipo de espacio es obligatorio"),
  layoutKey: z.string().nullable().optional(),
  propertyEnvironment: z.string().nullable().optional(),
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
  hasPrivateEntrance: z.boolean().optional(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  infrastructureJson: z.object({
    hasElevator: z.boolean().optional(),
    buildingFloors: z.number().int().min(1).max(200).optional(),
  }).optional(),
}).refine(
  (d) => (d.latitude == null) === (d.longitude == null),
  { message: "Latitud y longitud deben proporcionarse juntas", path: ["latitude"] },
).refine(
  (d) => d.roomType !== "rt.entire_place" || !!d.layoutKey,
  { message: "La distribución es obligatoria para alojamientos completos", path: ["layoutKey"] },
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
  parkingTypes: z.array(z.string()).optional().default([]),
  accessibilityFeatures: z.array(z.string()).optional().default([]),
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

const timeFormat = /^([01]\d|2[0-3]):[0-5]\d$/;

export const policiesSchema = z.object({
  quietHours: z.object({
    enabled: z.boolean(),
    from: z.string().regex(timeFormat, "Formato inválido, usa HH:MM").optional(),
    to: z.string().regex(timeFormat, "Formato inválido, usa HH:MM").optional(),
  }).superRefine((v, ctx) => {
    if (!v.enabled) return;
    if (!v.from) ctx.addIssue({ code: "custom", path: ["from"], message: "La hora de inicio es obligatoria" });
    if (!v.to) ctx.addIssue({ code: "custom", path: ["to"], message: "La hora de fin es obligatoria" });
  }),
  smoking: z.enum(["not_allowed", "outdoors_only", "designated_area", "no_restriction"]),
  smokingArea: z.string().nullable().optional(),
  events: z.object({
    policy: z.enum(["not_allowed", "small_gatherings", "with_approval"]),
    maxPeople: z.number().int().min(1).optional(),
    approvalInstructions: z.string().nullable().optional(),
  }).superRefine((v, ctx) => {
    if (v.policy === "small_gatherings" && v.maxPeople === undefined) {
      ctx.addIssue({ code: "custom", path: ["maxPeople"], message: "Indica el máximo de personas" });
    }
    if (v.policy === "with_approval" && (!v.approvalInstructions || v.approvalInstructions.trim().length === 0)) {
      ctx.addIssue({ code: "custom", path: ["approvalInstructions"], message: "Indica las instrucciones de aprobación" });
    }
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
  }).superRefine((v, ctx) => {
    if (!v.allowed) return;
    if (!v.types || v.types.length === 0) ctx.addIssue({ code: "custom", path: ["types"], message: "Selecciona al menos un tipo de mascota" });
    if (v.sizeRestriction === undefined) ctx.addIssue({ code: "custom", path: ["sizeRestriction"], message: "Indica la restricción de tamaño" });
    if (v.maxCount === undefined) ctx.addIssue({ code: "custom", path: ["maxCount"], message: "Indica el número máximo de mascotas" });
    if (v.feeMode === undefined) ctx.addIssue({ code: "custom", path: ["feeMode"], message: "Indica el tipo de cargo" });
    if (v.sizeRestriction === "custom_weight" && v.maxWeightKg === undefined) ctx.addIssue({ code: "custom", path: ["maxWeightKg"], message: "Indica el peso máximo" });
    if (v.feeMode && v.feeMode !== "none" && v.feeAmount === undefined) ctx.addIssue({ code: "custom", path: ["feeAmount"], message: "Indica el importe del cargo" });
  }),
  supplements: z.object({
    cleaning: z.object({ enabled: z.boolean(), amount: z.number().min(0).optional() }).superRefine((v, ctx) => {
      if (v.enabled && v.amount === undefined) ctx.addIssue({ code: "custom", path: ["amount"], message: "Indica el importe del suplemento de limpieza" });
    }),
    extraGuest: z.object({ enabled: z.boolean(), amount: z.number().min(0).optional(), fromGuest: z.number().int().min(1).optional() }).superRefine((v, ctx) => {
      if (!v.enabled) return;
      if (v.amount === undefined) ctx.addIssue({ code: "custom", path: ["amount"], message: "Indica el importe por huésped extra" });
      if (v.fromGuest === undefined) ctx.addIssue({ code: "custom", path: ["fromGuest"], message: "Indica a partir de cuántos huéspedes" });
    }),
  }),
  services: z.object({
    allowed: z.boolean(),
    types: z.array(z.string()).optional(),
    notes: z.string().nullable().optional(),
  }),
});

export type PoliciesData = z.infer<typeof policiesSchema>;

// ── Shared JSON record shape ──
// Flat key → (string | number | boolean | string[] | null) record. Used by
// space featuresJson and amenity detailsJson. Keep these aligned by
// referencing this constant rather than redefining inline.

export const flatJsonRecordSchema = z.record(
  z.string(),
  z.union([z.string(), z.number(), z.boolean(), z.array(z.string()), z.null()]),
);

// ── Space features ──

export const spaceFeaturesSchema = flatJsonRecordSchema;

export type SpaceFeaturesData = z.infer<typeof spaceFeaturesSchema>;

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

// ── Bed configurations ──

export const createBedSchema = z.object({
  bedType: z.string().min(1, "El tipo de cama es obligatorio"),
  quantity: z.number().int().min(1, "Mínimo 1").max(10, "Máximo 10"),
});

export const updateBedSchema = createBedSchema;

export type CreateBedData = z.infer<typeof createBedSchema>;
export type UpdateBedData = CreateBedData;

export const bedConfigSchema = z.object({
  mattressType: z.string().optional(),
  mattressFirmness: z.string().optional(),
  pillowTypes: z.array(z.string()).optional(),
  linenIncluded: z.boolean().optional(),
  extraBlanket: z.boolean().optional(),
  mattressProtector: z.boolean().optional(),
  customLabel: z.string().max(100).optional(),
  customCapacity: z.number().int().min(1).max(20).optional(),
});

export type BedConfigData = z.infer<typeof bedConfigSchema>;

// ── Amenities (S-14, S-15) ──

export const toggleAmenitySchema = z.object({
  amenityKey: z.string().min(1),
  enabled: z.boolean(),
});

export const updateAmenitySchema = z.object({
  subtypeKey: z.string().optional(),
  detailsJson: flatJsonRecordSchema.optional(),
  guestInstructions: z.string().optional(),
  aiInstructions: z.string().optional(),
  internalNotes: z.string().optional(),
  troubleshootingNotes: z.string().optional(),
  visibility: z.string().optional(),
});

export type ToggleAmenityData = z.infer<typeof toggleAmenitySchema>;
export type UpdateAmenityData = z.infer<typeof updateAmenitySchema>;

// ── Amenity instances (Phase 2 / Branch 2A) ──

export const createAmenityInstanceSchema = z.object({
  amenityKey: z.string().min(1),
  instanceKey: z.string().min(1).default("default"),
  subtypeKey: z.string().optional(),
  visibility: z.enum(["public", "internal", "sensitive"]).optional(),
});

export const updateAmenityInstanceSchema = z.object({
  subtypeKey: z.string().optional(),
  detailsJson: flatJsonRecordSchema.optional(),
  guestInstructions: z.string().optional(),
  aiInstructions: z.string().optional(),
  internalNotes: z.string().optional(),
  troubleshootingNotes: z.string().optional(),
  visibility: z.enum(["public", "internal", "sensitive"]).optional(),
});

export type CreateAmenityInstanceData = z.infer<typeof createAmenityInstanceSchema>;
export type UpdateAmenityInstanceData = z.infer<typeof updateAmenityInstanceSchema>;

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

// ── Systems (Branch 5) ──

export const createSystemSchema = z.object({
  systemKey: z.string().min(1, "El tipo de sistema es obligatorio"),
});

export const updateSystemSchema = z.object({
  detailsJson: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
  opsJson: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
  internalNotes: z.string().nullable().optional(),
  visibility: z.enum(["public", "internal"]).optional(),
});

export const updateSystemCoverageSchema = z.object({
  spaceId: z.string().min(1),
  mode: z.enum(["inherited", "override_yes", "override_no"]),
  note: z.string().nullable().optional(),
});

export type CreateSystemData = z.infer<typeof createSystemSchema>;
export type UpdateSystemData = z.infer<typeof updateSystemSchema>;
export type UpdateSystemCoverageData = z.infer<typeof updateSystemCoverageSchema>;
