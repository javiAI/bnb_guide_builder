import { z } from "zod";

export const step1Schema = z.object({
  propertyType: z.string().min(1, "Selecciona un tipo de alojamiento"),
  roomType: z.string().min(1, "Selecciona un tipo de espacio"),
  layoutKey: z.string().optional(),
  customPropertyTypeLabel: z.string().optional(),
  customPropertyTypeDesc: z.string().optional(),
  customRoomTypeLabel: z.string().optional(),
  customRoomTypeDesc: z.string().optional(),
}).refine(
  (d) => d.propertyType !== "pt.other" || (d.customPropertyTypeLabel && d.customPropertyTypeLabel.length > 0),
  { message: "El nombre del tipo personalizado es obligatorio", path: ["customPropertyTypeLabel"] },
).refine(
  (d) => d.roomType !== "rt.other" || (d.customRoomTypeLabel && d.customRoomTypeLabel.length > 0),
  { message: "El nombre del espacio personalizado es obligatorio", path: ["customRoomTypeLabel"] },
).refine(
  (d) => d.roomType !== "rt.entire_place" || !!d.layoutKey,
  { message: "Selecciona la distribución del alojamiento", path: ["layoutKey"] },
);

export const step2Schema = z.object({
  country: z.string().min(1, "El país es obligatorio"),
  city: z.string().min(1, "La ciudad es obligatoria"),
  region: z.string().nullable().optional(),
  postalCode: z.string().nullable().optional(),
  streetAddress: z.string().min(1, "La dirección es obligatoria"),
  addressExtra: z.string().nullable().optional(),
  addressLevel: z.string().optional(),
  timezone: z.string().min(1, "La zona horaria es obligatoria"),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
}).refine(
  (d) => (d.latitude == null) === (d.longitude == null),
  { message: "Latitud y longitud deben proporcionarse juntas", path: ["latitude"] },
);

const bedConfigSchema = z.object({
  spaceIndex: z.number().int().min(0),
  spaceType: z.string().min(1),
  spaceLabel: z.string().optional(),
  bedType: z.string().min(1),
  quantity: z.number().int().min(1),
});

export const step3Schema = z.object({
  maxGuests: z.number().int().min(1, "Al menos 1 huésped"),
  maxAdults: z.number().int().min(1, "Al menos 1 adulto"),
  maxChildren: z.number().int().min(0),
  infantsAllowed: z.boolean().optional(),
  bedroomsCount: z.number().int().min(0),
  bathroomsCount: z.number().int().min(1, "Al menos 1 baño"),
  beds: z.array(bedConfigSchema).min(1, "Añade al menos una cama"),
}).refine(
  (d) => d.maxAdults + d.maxChildren === d.maxGuests,
  { message: "La suma de adultos y niños debe ser igual al máximo de huéspedes", path: ["maxAdults"] },
);

const accessLayerSchema = z.object({
  methods: z.array(z.string()),
  customLabel: z.string().nullable().optional(),
  customDesc: z.string().nullable().optional(),
});

export const step4Schema = z.object({
  checkInStart: z.string().min(1, "La hora de entrada es obligatoria"),
  checkInEnd: z.string().min(1, "Selecciona hora límite o flexible"),
  checkOutTime: z.string().min(1, "La hora de salida es obligatoria"),
  isAutonomousCheckin: z.boolean(),
  hasBuildingAccess: z.boolean(),
  buildingAccess: accessLayerSchema.optional(),
  unitAccess: accessLayerSchema.refine(
    (d) => d.methods.length > 0,
    { message: "Selecciona al menos un método de acceso a la vivienda" },
  ),
  hostName: z.string().optional(),
  hostContactPhone: z.string().optional(),
  wifiSsid: z.string().optional(),
  wifiPassword: z.string().optional(),
});

export const createDraftSchema = z.object({
  workspaceId: z.string().min(1),
  propertyNickname: z.string().min(1, "El nombre es obligatorio"),
});

export const fullWizardSchema = z.object({
  propertyNickname: z.string().min(1),
  propertyType: z.string().min(1),
  roomType: z.string().min(1),
  layoutKey: z.string().optional(),
  customPropertyTypeLabel: z.string().optional(),
  customPropertyTypeDesc: z.string().optional(),
  customRoomTypeLabel: z.string().optional(),
  customRoomTypeDesc: z.string().optional(),
  country: z.string().min(1),
  city: z.string().min(1),
  region: z.string().nullable().optional(),
  postalCode: z.string().nullable().optional(),
  streetAddress: z.string().min(1),
  addressExtra: z.string().nullable().optional(),
  addressLevel: z.string().optional(),
  timezone: z.string().min(1),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  maxGuests: z.number().int().min(1),
  maxAdults: z.number().int().min(1),
  maxChildren: z.number().int().min(0),
  infantsAllowed: z.boolean().optional(),
  bedroomsCount: z.number().int().min(0),
  bathroomsCount: z.number().int().min(1),
  beds: z.array(bedConfigSchema).min(1),
  checkInStart: z.string().min(1),
  checkInEnd: z.string().min(1),
  checkOutTime: z.string().min(1),
  isAutonomousCheckin: z.boolean(),
  hasBuildingAccess: z.boolean(),
  buildingAccess: accessLayerSchema.optional(),
  unitAccess: accessLayerSchema.refine(
    (d) => d.methods.length > 0,
    { message: "Selecciona al menos un método de acceso a la vivienda", path: ["methods"] },
  ),
  hostName: z.string().optional(),
  hostContactPhone: z.string().optional(),
  wifiSsid: z.string().optional(),
  wifiPassword: z.string().optional(),
}).refine(
  (d) => d.propertyType !== "pt.other" || (d.customPropertyTypeLabel && d.customPropertyTypeLabel.length > 0),
  { message: "El nombre del tipo personalizado es obligatorio", path: ["customPropertyTypeLabel"] },
).refine(
  (d) => d.roomType !== "rt.other" || (d.customRoomTypeLabel && d.customRoomTypeLabel.length > 0),
  { message: "El nombre del espacio personalizado es obligatorio", path: ["customRoomTypeLabel"] },
).refine(
  (d) => d.maxAdults + d.maxChildren === d.maxGuests,
  { message: "La suma de adultos y niños debe ser igual al máximo de huéspedes", path: ["maxAdults"] },
).refine(
  (d) => (d.latitude == null) === (d.longitude == null),
  { message: "Latitud y longitud deben proporcionarse juntas", path: ["latitude"] },
);

export type Step1Data = z.infer<typeof step1Schema>;
export type Step2Data = z.infer<typeof step2Schema>;
export type Step3Data = z.infer<typeof step3Schema>;
export type Step4Data = z.infer<typeof step4Schema>;
export type CreateDraftData = z.infer<typeof createDraftSchema>;
export type FullWizardData = z.infer<typeof fullWizardSchema>;
