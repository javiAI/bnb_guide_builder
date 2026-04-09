import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock prisma before importing the page
vi.mock("@/lib/db", () => ({
  prisma: {
    property: {
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db";
import DashboardPage from "@/app/page";

const mockFindMany = prisma.property.findMany as ReturnType<typeof vi.fn>;

describe("Dashboard page (S-01)", () => {
  beforeEach(() => {
    mockFindMany.mockReset();
  });

  it("renders the Propiedades heading", async () => {
    mockFindMany.mockResolvedValue([]);
    const Page = await DashboardPage();
    render(Page);
    expect(screen.getByText("Propiedades")).toBeInTheDocument();
  });

  it("shows empty state when no properties exist", async () => {
    mockFindMany.mockResolvedValue([]);
    const Page = await DashboardPage();
    render(Page);
    expect(screen.getByText("Sin propiedades todavía")).toBeInTheDocument();
  });

  it("shows CTA to create a property in empty state", async () => {
    mockFindMany.mockResolvedValue([]);
    const Page = await DashboardPage();
    render(Page);
    expect(screen.getByText("Crear propiedad")).toBeInTheDocument();
  });

  it("all visible labels are in Spanish", async () => {
    mockFindMany.mockResolvedValue([]);
    const Page = await DashboardPage();
    render(Page);
    expect(screen.getByText("Propiedades")).toBeInTheDocument();
    expect(screen.getByText(/Gestiona tus alojamientos/)).toBeInTheDocument();
    expect(screen.getByText("Crear propiedad")).toBeInTheDocument();
  });

  it("renders property cards when properties exist", async () => {
    mockFindMany.mockResolvedValue([
      {
        id: "p1",
        propertyNickname: "Casa Playa",
        status: "draft",
        city: "Valencia",
        country: "España",
        maxGuests: 4,
        bedroomsCount: 2,
        bathroomsCount: 1,
      },
    ]);
    const Page = await DashboardPage();
    render(Page);
    expect(screen.getByText("Casa Playa")).toBeInTheDocument();
    expect(screen.getByText("Valencia, España")).toBeInTheDocument();
    expect(screen.getByText("4 huéspedes")).toBeInTheDocument();
  });
});
