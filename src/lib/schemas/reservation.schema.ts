import { z } from "zod";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const reservationDateField = z
  .string()
  .regex(ISO_DATE, "Usa el formato YYYY-MM-DD");

export const createReservationSchema = z
  .object({
    propertyId: z.string().min(1),
    guestName: z.string().min(1, "Nombre del huésped obligatorio"),
    checkInDate: reservationDateField,
    checkOutDate: reservationDateField,
    numGuests: z.number().int().min(1, "Al menos 1 huésped"),
    locale: z
      .string()
      .trim()
      .min(2)
      .max(10)
      .optional()
      .or(z.literal("").transform(() => undefined)),
    source: z.string().default("manual"),
    externalId: z
      .string()
      .trim()
      .min(1)
      .optional()
      .or(z.literal("").transform(() => undefined)),
  })
  .refine((d) => d.checkInDate < d.checkOutDate, {
    message: "El check-out debe ser posterior al check-in",
    path: ["checkOutDate"],
  });

export const updateReservationSchema = z
  .object({
    reservationId: z.string().min(1),
    guestName: z.string().min(1).optional(),
    checkInDate: reservationDateField.optional(),
    checkOutDate: reservationDateField.optional(),
    numGuests: z.number().int().min(1).optional(),
    locale: z
      .string()
      .trim()
      .min(2)
      .max(10)
      .optional()
      .or(z.literal("").transform(() => undefined)),
  })
  .refine(
    (d) =>
      !d.checkInDate ||
      !d.checkOutDate ||
      d.checkInDate < d.checkOutDate,
    {
      message: "El check-out debe ser posterior al check-in",
      path: ["checkOutDate"],
    },
  );

export type CreateReservationData = z.infer<typeof createReservationSchema>;
export type UpdateReservationData = z.infer<typeof updateReservationSchema>;
