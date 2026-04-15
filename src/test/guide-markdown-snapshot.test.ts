import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    property: { findUnique: vi.fn() },
    space: { findMany: vi.fn() },
    propertyAmenityInstance: { findMany: vi.fn() },
    contact: { findMany: vi.fn() },
    localPlace: { findMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/db";
import { composeGuide } from "@/lib/services/guide-rendering.service";
import { renderMarkdown } from "@/lib/renderers/guide-markdown";

const fn = <K extends keyof typeof prisma>(table: K, method: "findUnique" | "findMany") =>
  (prisma[table] as unknown as Record<string, ReturnType<typeof vi.fn>>)[method];

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-04-16T12:00:00.000Z"));
  fn("property", "findUnique").mockResolvedValue({
    id: "p1",
    checkInStart: "15:00",
    checkInEnd: "20:00",
    checkOutTime: "11:00",
    primaryAccessMethod: null,
    accessMethodsJson: null,
    policiesJson: null,
  });
  fn("space", "findMany").mockResolvedValue([
    {
      id: "s1",
      spaceType: "sp.bedroom",
      name: "Dormitorio principal",
      visibility: "guest",
      guestNotes: "Vistas al patio",
      aiNotes: null,
      internalNotes: "Revisar cortinas",
      featuresJson: null,
      sortOrder: 0,
      beds: [{ id: "b1", bedType: "bt.double", quantity: 1 }],
    },
  ]);
  fn("propertyAmenityInstance", "findMany").mockResolvedValue([]);
  fn("contact", "findMany").mockResolvedValue([
    {
      id: "c1",
      roleKey: "contact.host",
      displayName: "Ana",
      phone: "600000000",
      email: null,
      guestVisibleNotes: null,
      internalNotes: "Tarea pendiente",
      emergencyAvailable: false,
      sortOrder: 0,
      visibility: "guest",
    },
  ]);
  fn("localPlace", "findMany").mockResolvedValue([]);
});

afterEach(() => {
  vi.useRealTimers();
});

// The markdown output contains nothing time-dependent (propertyId + audience
// header is deterministic), so we can snapshot the full thing.

describe("renderMarkdown — snapshot by audience", () => {
  it("guest snapshot", async () => {
    const tree = await composeGuide("p1", "guest");
    const md = renderMarkdown(tree);
    expect(md).toMatchInlineSnapshot(`
      "# p1 — audiencia: guest
      _Generado: 2026-04-16T12:00:00.000Z_

      ## Llegada
      - **Check-in**: 15:00 – 20:00
      - **Check-out**: 11:00

      ## Espacios
      - **Dormitorio principal**: Dormitorio
        - Notas: Vistas al patio
        - Cama doble: 1

      ## Equipamiento
      _Sin elementos._

      ## Normas de la casa
      _Sin elementos._

      ## Contactos
      - **Ana**: contact.host
        - Teléfono: 600000000

      ## Guía local
      _Sin elementos._

      ## Emergencias
      _Sin elementos._
      "
    `);
  });

  it("internal audience exposes internal-visibility fields not in guest snapshot", async () => {
    const guestTree = await composeGuide("p1", "guest");
    const internalTree = await composeGuide("p1", "internal");
    const guestMd = renderMarkdown(guestTree);
    const internalMd = renderMarkdown(internalTree);
    expect(guestMd).not.toContain("Notas internas");
    expect(internalMd).toContain("Notas internas");
    expect(internalMd).toContain("Revisar cortinas");
    expect(internalMd).toContain("Tarea pendiente");
  });
});
