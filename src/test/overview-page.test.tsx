import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ReadinessHeroCard } from "@/components/overview/readiness-hero-card";
import { TasksListCard } from "@/components/overview/tasks-list-card";
import { KpiStrip } from "@/components/overview/kpi-strip";
import {
  ActivityFeedCard,
  type ActivityFeedItem,
} from "@/components/overview/activity-feed-card";
import {
  SpacesTableCard,
  type SpacesTableRow,
} from "@/components/overview/spaces-table-card";
import type { ValidationFinding } from "@/lib/validations/cross-validations";

describe("ReadinessHeroCard", () => {
  it("shows the overall percentage in the ring", () => {
    render(
      <ReadinessHeroCard
        propertyId="p1"
        overall={75}
        publishable={false}
        usable
        scores={{ spaces: 80, amenities: 60, systems: 70, arrival: 90 }}
        blockers={[]}
        errors={[]}
      />,
    );
    expect(screen.getByText("75")).toBeInTheDocument();
    expect(screen.getByText(/Completitud · 75 de 100/)).toBeInTheDocument();
  });

  it("celebrates when publishable with no issues", () => {
    render(
      <ReadinessHeroCard
        propertyId="p1"
        overall={92}
        publishable
        usable
        scores={{ spaces: 90, amenities: 90, systems: 90, arrival: 90 }}
        blockers={[]}
        errors={[]}
      />,
    );
    expect(screen.getByText(/Tu guía está lista/)).toBeInTheDocument();
  });

  it("surfaces blockers count and first 3 messages", () => {
    const blocker: ValidationFinding = {
      id: "wifi_incomplete",
      severity: "blocker",
      message: "Wifi configurado sin SSID",
      ctaUrl: "/properties/p1/systems",
      ctaLabel: "Completar wifi",
    };
    render(
      <ReadinessHeroCard
        propertyId="p1"
        overall={60}
        publishable={false}
        usable={false}
        scores={{ spaces: 30, amenities: 40, systems: 20, arrival: 50 }}
        blockers={[blocker]}
        errors={[]}
      />,
    );
    expect(screen.getByText("Wifi configurado sin SSID")).toBeInTheDocument();
    expect(screen.getByText("Completar wifi")).toBeInTheDocument();
    expect(screen.getByText(/1 incidencia pendiente/)).toBeInTheDocument();
  });
});

describe("TasksListCard", () => {
  const blocker: ValidationFinding = {
    id: "wifi_incomplete",
    severity: "blocker",
    message: "Wifi configurado sin SSID",
    ctaUrl: "/properties/p1/systems",
    ctaLabel: "Completar wifi",
  };

  it("prioritises blockers above section gaps", () => {
    render(
      <TasksListCard
        propertyId="p1"
        scores={{ spaces: 10, amenities: 20, systems: 30, arrival: 40 }}
        blockers={[blocker]}
        errors={[]}
      />,
    );
    expect(screen.getByText("Wifi configurado sin SSID")).toBeInTheDocument();
  });

  it("falls back to lowest section when no blockers", () => {
    render(
      <TasksListCard
        propertyId="p1"
        scores={{ spaces: 80, amenities: 40, systems: 90, arrival: 60 }}
        blockers={[]}
        errors={[]}
      />,
    );
    expect(screen.getByText("Mejora equipamiento")).toBeInTheDocument();
  });

  it("shows celebrate state when everything is publishable", () => {
    render(
      <TasksListCard
        propertyId="p1"
        scores={{ spaces: 90, amenities: 90, systems: 90, arrival: 90 }}
        blockers={[]}
        errors={[]}
      />,
    );
    expect(screen.getByText(/Todo listo/)).toBeInTheDocument();
  });

  it("renders at most 3 tasks", () => {
    const blockers: ValidationFinding[] = Array.from({ length: 5 }).map(
      (_, i) => ({
        id: `b${i}`,
        severity: "blocker" as const,
        message: `Bloqueante ${i}`,
      }),
    );
    render(
      <TasksListCard
        propertyId="p1"
        scores={{ spaces: 80, amenities: 80, systems: 80, arrival: 80 }}
        blockers={blockers}
        errors={[]}
      />,
    );
    expect(screen.getByText("Bloqueante 0")).toBeInTheDocument();
    expect(screen.getByText("Bloqueante 1")).toBeInTheDocument();
    expect(screen.getByText("Bloqueante 2")).toBeInTheDocument();
    expect(screen.queryByText("Bloqueante 3")).toBeNull();
  });
});

describe("KpiStrip", () => {
  it("renders the four KPIs with their counts", () => {
    render(
      <KpiStrip
        propertyId="p1"
        spacesCount={4}
        amenityCount={18}
        contactsCount={3}
        blockersCount={1}
      />,
    );
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("18")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("Espacios")).toBeInTheDocument();
    expect(screen.getByText("Bloqueantes")).toBeInTheDocument();
  });
});

describe("ActivityFeedCard", () => {
  it("shows empty copy when there are no entries", () => {
    render(<ActivityFeedCard propertyId="p1" items={[]} />);
    expect(screen.getByText(/Sin actividad/)).toBeInTheDocument();
  });

  it("renders each feed item with its message", () => {
    const items: ActivityFeedItem[] = [
      {
        id: "1",
        message: "Space actualizado",
        whenISO: new Date().toISOString(),
      },
    ];
    render(<ActivityFeedCard propertyId="p1" items={items} />);
    expect(screen.getByText("Space actualizado")).toBeInTheDocument();
  });
});

describe("SpacesTableCard", () => {
  it("shows empty state with CTA when no rows", () => {
    render(<SpacesTableCard propertyId="p1" rows={[]} totalCount={0} />);
    expect(screen.getByText(/Aún no has añadido espacios/)).toBeInTheDocument();
    expect(screen.getByText("Añadir espacio")).toBeInTheDocument();
  });

  it("renders rows with their counts and status", () => {
    const rows: SpacesTableRow[] = [
      {
        id: "s1",
        name: "Dormitorio principal",
        spaceTypeLabel: "Dormitorio",
        amenityCount: 6,
        photoCount: 4,
        updatedAtISO: new Date().toISOString(),
        status: { label: "Completo", tone: "success" },
      },
    ];
    render(<SpacesTableCard propertyId="p1" rows={rows} totalCount={1} />);
    // Row appears twice (desktop table + mobile list); both should reflect data
    expect(screen.getAllByText("Dormitorio principal").length).toBeGreaterThan(0);
    expect(screen.getByText("6 items")).toBeInTheDocument();
    expect(screen.getByText("4 fotos")).toBeInTheDocument();
    expect(screen.getAllByText("Completo").length).toBeGreaterThan(0);
  });
});
