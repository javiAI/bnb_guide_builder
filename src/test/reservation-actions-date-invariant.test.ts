// Partial-update date invariant: `updateReservationSchema` only enforces
// `checkInDate < checkOutDate` when BOTH are present. `updateReservationAction`
// must re-check the invariant against the persisted row so partial updates
// can't leave the reservation with `checkInDate >= checkOutDate`.

import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    reservation: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/services/messaging-automation.service", () => ({
  materializeDraftsForReservation: vi.fn(async () => []),
  cancelDraftsForReservation: vi.fn(async () => 0),
}));

import { updateReservationAction } from "@/lib/actions/reservation.actions";

function formData(data: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(data)) fd.set(k, v);
  return fd;
}

const EXISTING = {
  id: "r_1",
  propertyId: "p_1",
  status: "confirmed",
  checkInDate: new Date("2026-05-10T00:00:00Z"),
  checkOutDate: new Date("2026-05-13T00:00:00Z"),
};

beforeEach(() => {
  prismaMock.reservation.findUnique.mockReset();
  prismaMock.reservation.update.mockReset();
  prismaMock.reservation.findUnique.mockResolvedValue(EXISTING);
  prismaMock.reservation.update.mockResolvedValue({ id: "r_1" });
});

describe("updateReservationAction — partial date invariant", () => {
  it("rejects partial update that pushes checkInDate past existing checkOutDate", async () => {
    const fd = formData({
      reservationId: "r_1",
      checkInDate: "2026-05-20", // existing checkOut is 2026-05-13
    });

    const result = await updateReservationAction(null, fd);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.fieldErrors?.checkOutDate).toBeDefined();
      expect(result.fieldErrors?.checkOutDate?.[0]).toBe(
        "La fecha de salida debe ser posterior a la de llegada",
      );
    }
    expect(prismaMock.reservation.update).not.toHaveBeenCalled();
  });

  it("rejects partial update that pulls checkOutDate before existing checkInDate", async () => {
    const fd = formData({
      reservationId: "r_1",
      checkOutDate: "2026-05-05", // existing checkIn is 2026-05-10
    });

    const result = await updateReservationAction(null, fd);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.fieldErrors?.checkOutDate).toBeDefined();
    }
    expect(prismaMock.reservation.update).not.toHaveBeenCalled();
  });

  it("rejects partial update that makes the two dates equal", async () => {
    const fd = formData({
      reservationId: "r_1",
      checkInDate: "2026-05-13", // matches existing checkOutDate
    });

    const result = await updateReservationAction(null, fd);

    expect(result.success).toBe(false);
    expect(prismaMock.reservation.update).not.toHaveBeenCalled();
  });

  it("accepts a valid partial update that preserves the invariant", async () => {
    const fd = formData({
      reservationId: "r_1",
      checkInDate: "2026-05-11", // still before existing checkOutDate (2026-05-13)
    });

    const result = await updateReservationAction(null, fd);

    expect(result.success).toBe(true);
    expect(prismaMock.reservation.update).toHaveBeenCalledOnce();
  });
});
