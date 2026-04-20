"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

import {
  createReservationSchema,
  updateReservationSchema,
} from "@/lib/schemas/reservation.schema";
import {
  cancelDraftsForReservation,
  materializeDraftsForReservation,
} from "@/lib/services/messaging-automation.service";
import type { ActionResult } from "@/lib/types/action-result";
import { isPrismaUniqueViolation } from "@/lib/utils";

// ── Helpers ──

function parseIsoDate(s: string): Date {
  // Store as midnight UTC; property timezone is applied at schedule time.
  return new Date(`${s}T00:00:00Z`);
}

function num(value: FormDataEntryValue | null): number {
  return Number(value ?? 0);
}

function str(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value : "";
}

// ── Create ──

export async function createReservationAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const raw = {
    propertyId: str(formData.get("propertyId")),
    guestName: str(formData.get("guestName")).trim(),
    checkInDate: str(formData.get("checkInDate")),
    checkOutDate: str(formData.get("checkOutDate")),
    numGuests: num(formData.get("numGuests")),
    locale: str(formData.get("locale")).trim() || undefined,
    source: str(formData.get("source")) || "manual",
    externalId: str(formData.get("externalId")).trim() || undefined,
  };

  const parsed = createReservationSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }
  const data = parsed.data;

  try {
    const created = await prisma.reservation.create({
      data: {
        propertyId: data.propertyId,
        guestName: data.guestName,
        checkInDate: parseIsoDate(data.checkInDate),
        checkOutDate: parseIsoDate(data.checkOutDate),
        numGuests: data.numGuests,
        locale: data.locale ?? null,
        source: data.source,
        externalId: data.externalId ?? null,
      },
      select: { id: true, propertyId: true },
    });

    await materializeDraftsForReservation(created.id);
    revalidatePath(`/properties/${created.propertyId}/reservations`);
    revalidatePath(`/properties/${created.propertyId}/messaging`);
    return { success: true };
  } catch (err) {
    if (isPrismaUniqueViolation(err)) {
      return {
        success: false,
        fieldErrors: {
          externalId: ["Ya existe una reserva con ese externalId para esta fuente"],
        },
      };
    }
    throw err;
  }
}

// ── Update ──

export async function updateReservationAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const localePresent = formData.has("locale");
  const rawLocale = str(formData.get("locale")).trim();
  const raw = {
    reservationId: str(formData.get("reservationId")),
    guestName: str(formData.get("guestName")).trim() || undefined,
    checkInDate: str(formData.get("checkInDate")) || undefined,
    checkOutDate: str(formData.get("checkOutDate")) || undefined,
    numGuests: formData.get("numGuests") ? num(formData.get("numGuests")) : undefined,
    locale: rawLocale || undefined,
  };

  const parsed = updateReservationSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }
  const data = parsed.data;

  const existing = await prisma.reservation.findUnique({
    where: { id: data.reservationId },
    select: { id: true, propertyId: true, status: true },
  });
  if (!existing) return { success: false, error: "Reserva no encontrada" };
  if (existing.status === "cancelled") {
    return { success: false, error: "No se puede editar una reserva cancelada" };
  }

  // locale: distinguish "field absent" (leave alone) from "field present but
  // blank" (explicit clear → null). The Zod schema collapses "" → undefined
  // so we can't rely on it here.
  const localeUpdate =
    localePresent && rawLocale === ""
      ? null
      : (data.locale ?? undefined);

  await prisma.reservation.update({
    where: { id: data.reservationId },
    data: {
      guestName: data.guestName,
      checkInDate: data.checkInDate ? parseIsoDate(data.checkInDate) : undefined,
      checkOutDate: data.checkOutDate ? parseIsoDate(data.checkOutDate) : undefined,
      numGuests: data.numGuests,
      locale: localeUpdate,
    },
  });

  await materializeDraftsForReservation(data.reservationId);
  revalidatePath(`/properties/${existing.propertyId}/reservations`);
  revalidatePath(`/properties/${existing.propertyId}/messaging`);
  return { success: true };
}

// ── Cancel ──

export async function cancelReservationAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const reservationId = str(formData.get("reservationId"));
  if (!reservationId) return { success: false, error: "reservationId obligatorio" };

  const existing = await prisma.reservation.findUnique({
    where: { id: reservationId },
    select: { id: true, propertyId: true, status: true },
  });
  if (!existing) return { success: false, error: "Reserva no encontrada" };
  if (existing.status === "cancelled") {
    return { success: true };
  }

  await prisma.$transaction(async (tx) => {
    await tx.reservation.update({
      where: { id: reservationId },
      data: { status: "cancelled", cancelledAt: new Date() },
    });
    await cancelDraftsForReservation(reservationId, { client: tx });
  });

  revalidatePath(`/properties/${existing.propertyId}/reservations`);
  revalidatePath(`/properties/${existing.propertyId}/messaging`);
  return { success: true };
}
