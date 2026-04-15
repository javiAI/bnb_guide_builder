import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CapacityCard } from "@/components/overview/capacity-card";
import { GapsCard } from "@/components/overview/gaps-card";
import { PublishReadinessCard } from "@/components/overview/publish-readiness-card";
import { NextActionCard } from "@/components/overview/next-action-card";
import type { ValidationFinding } from "@/lib/validations/cross-validations";

describe("CapacityCard", () => {
  it("shows coherente when maxGuests ≤ sleeping capacity", () => {
    render(<CapacityCard propertyId="p1" maxGuests={4} sleepingCapacity={4} />);
    expect(screen.getByText("Coherente")).toBeInTheDocument();
    expect(screen.getAllByText("4").length).toBeGreaterThanOrEqual(2);
  });

  it("warns when maxGuests exceeds sleeping capacity", () => {
    render(<CapacityCard propertyId="p1" maxGuests={6} sleepingCapacity={4} />);
    expect(screen.getByText("Revisar")).toBeInTheDocument();
    expect(screen.getByText(/supera la capacidad/)).toBeInTheDocument();
  });

  it("shows 'Aforo no configurado' when maxGuests is null", () => {
    render(<CapacityCard propertyId="p1" maxGuests={null} sleepingCapacity={4} />);
    expect(screen.getByText("Aforo no configurado")).toBeInTheDocument();
  });

  it("shows 'Sin camas' when no beds are configured", () => {
    render(<CapacityCard propertyId="p1" maxGuests={4} sleepingCapacity={0} />);
    expect(screen.getByText("Sin camas")).toBeInTheDocument();
  });
});

describe("GapsCard", () => {
  it("lists all four sections sorted by score ascending", () => {
    render(
      <GapsCard
        propertyId="p1"
        scores={{ spaces: 90, amenities: 40, systems: 70, arrival: 20 }}
      />,
    );
    const labels = screen.getAllByText(
      /Espacios|Equipamiento|Sistemas|Acceso y llegada/,
    );
    expect(labels.map((n) => n.textContent)).toEqual([
      "Acceso y llegada",
      "Equipamiento",
      "Sistemas",
      "Espacios",
    ]);
  });

  it("renders each score as a percentage", () => {
    render(
      <GapsCard
        propertyId="p1"
        scores={{ spaces: 90, amenities: 40, systems: 70, arrival: 20 }}
      />,
    );
    expect(screen.getByText("90%")).toBeInTheDocument();
    expect(screen.getByText("20%")).toBeInTheDocument();
  });
});

describe("PublishReadinessCard", () => {
  const blocker: ValidationFinding = {
    id: "wifi_incomplete",
    severity: "blocker",
    message: "Wifi configurado sin SSID",
    ctaUrl: "/properties/p1/systems",
    ctaLabel: "Completar wifi",
  };

  it("shows publicable badge and happy state when no issues", () => {
    render(
      <PublishReadinessCard
        propertyId="p1"
        overall={92}
        usable
        publishable
        blockers={[]}
        errors={[]}
      />,
    );
    expect(screen.getByText("Publicable")).toBeInTheDocument();
    expect(screen.getByText("92%")).toBeInTheDocument();
    expect(screen.getByText(/Sin bloqueantes/)).toBeInTheDocument();
  });

  it("lists blockers with their CTA when present", () => {
    render(
      <PublishReadinessCard
        propertyId="p1"
        overall={60}
        usable={false}
        publishable={false}
        blockers={[blocker]}
        errors={[]}
      />,
    );
    expect(screen.getByText("No publicable")).toBeInTheDocument();
    expect(screen.getByText("Wifi configurado sin SSID")).toBeInTheDocument();
    expect(screen.getByText("Completar wifi")).toBeInTheDocument();
  });
});

describe("NextActionCard", () => {
  const blocker: ValidationFinding = {
    id: "wifi_incomplete",
    severity: "blocker",
    message: "Wifi configurado sin SSID",
    ctaUrl: "/properties/p1/systems",
    ctaLabel: "Completar wifi",
  };

  it("prioritises blockers over low section scores", () => {
    render(
      <NextActionCard
        propertyId="p1"
        scores={{ spaces: 10, amenities: 20, systems: 30, arrival: 40 }}
        blockers={[blocker]}
        errors={[]}
      />,
    );
    expect(screen.getByText("Resuelve un bloqueante")).toBeInTheDocument();
    expect(screen.getByText("Wifi configurado sin SSID")).toBeInTheDocument();
  });

  it("falls back to lowest section score when no blockers/errors", () => {
    render(
      <NextActionCard
        propertyId="p1"
        scores={{ spaces: 80, amenities: 40, systems: 90, arrival: 60 }}
        blockers={[]}
        errors={[]}
      />,
    );
    expect(screen.getByText("Mejora Equipamiento")).toBeInTheDocument();
    expect(screen.getByText(/Score actual: 40%/)).toBeInTheDocument();
  });

  it("shows celebrate state when everything is publishable", () => {
    render(
      <NextActionCard
        propertyId="p1"
        scores={{ spaces: 90, amenities: 90, systems: 90, arrival: 90 }}
        blockers={[]}
        errors={[]}
      />,
    );
    expect(screen.getByText(/Todo listo/)).toBeInTheDocument();
  });
});
