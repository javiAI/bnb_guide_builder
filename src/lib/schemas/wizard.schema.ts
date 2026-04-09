import { z } from "zod";

export const step1Schema = z.object({
  propertyType: z.string().min(1, "Selecciona un tipo de alojamiento"),
  roomType: z.string().min(1, "Selecciona un tipo de espacio"),
});

export const step2Schema = z.object({
  country: z.string().min(1, "El país es obligatorio"),
  city: z.string().min(1, "La ciudad es obligatoria"),
  region: z.string().optional(),
  postalCode: z.string().optional(),
  streetAddress: z.string().optional(),
  addressLevel: z.string().optional(),
  timezone: z.string().min(1, "La zona horaria es obligatoria"),
});

export const step3Schema = z.object({
  maxGuests: z.number().int().min(1, "Al menos 1 huésped"),
  bedroomsCount: z.number().int().min(0),
  bedsCount: z.number().int().min(1, "Al menos 1 cama"),
  bathroomsCount: z.number().int().min(1, "Al menos 1 baño"),
});

export const step4Schema = z.object({
  checkInStart: z.string().min(1, "La hora de entrada es obligatoria"),
  checkInEnd: z.string().min(1, "La hora límite de entrada es obligatoria"),
  checkOutTime: z.string().min(1, "La hora de salida es obligatoria"),
  primaryAccessMethod: z.string().min(1, "Selecciona un método de acceso"),
  hostContactPhone: z.string().optional(),
  supportContact: z.string().optional(),
});

export const createDraftSchema = z.object({
  workspaceId: z.string().min(1),
  propertyNickname: z.string().min(1, "El nombre es obligatorio"),
});

export type Step1Data = z.infer<typeof step1Schema>;
export type Step2Data = z.infer<typeof step2Schema>;
export type Step3Data = z.infer<typeof step3Schema>;
export type Step4Data = z.infer<typeof step4Schema>;
export type CreateDraftData = z.infer<typeof createDraftSchema>;
