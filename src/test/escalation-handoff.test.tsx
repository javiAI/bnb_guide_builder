import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { EscalationHandoff } from "@/components/assistant/EscalationHandoff";
import type { EscalationResolutionDTO } from "@/lib/schemas/assistant.schema";

function resolution(
  overrides: Partial<EscalationResolutionDTO> = {},
): EscalationResolutionDTO {
  return {
    intentId: "int.lockout",
    intentLabel: "Sin acceso",
    emergencyPriority: false,
    fallbackLevel: "intent",
    contacts: [
      {
        id: "c1",
        roleKey: "ct.locksmith",
        displayName: "Cerrajero 24h",
        channels: [
          { kind: "tel", rawValue: "+34600111222", href: "tel:+34600111222" },
          {
            kind: "whatsapp",
            rawValue: "+34600111222",
            href: "https://wa.me/34600111222",
          },
        ],
        emergencyAvailable: true,
        isPrimary: true,
        notes: null,
      },
    ],
    ...overrides,
  };
}

describe("<EscalationHandoff>", () => {
  it("renders the intent label + non-emergency banner by default", () => {
    render(<EscalationHandoff handoff={resolution()} />);
    expect(screen.getByText("Sin acceso")).toBeTruthy();
    expect(screen.getByText("Contacto")).toBeTruthy();
  });

  it("renders an Emergencia banner when emergencyPriority is true", () => {
    render(
      <EscalationHandoff
        handoff={resolution({ emergencyPriority: true, intentLabel: "Emergencia médica" })}
      />,
    );
    expect(screen.getByText("Emergencia")).toBeTruthy();
    expect(screen.getByText("Emergencia médica")).toBeTruthy();
  });

  it("builds tel: and wa.me hrefs with targets ≥44x44", () => {
    render(<EscalationHandoff handoff={resolution()} />);
    const tel = screen.getByText("Llamar").closest("a");
    const wa = screen.getByText("WhatsApp").closest("a");
    expect(tel?.getAttribute("href")).toBe("tel:+34600111222");
    expect(wa?.getAttribute("href")).toBe("https://wa.me/34600111222");
    expect(tel?.className).toMatch(/min-h-\[44px\]/);
    expect(tel?.className).toMatch(/min-w-\[44px\]/);
  });

  it("surfaces the fallback-level copy when host was used as fallback", () => {
    render(
      <EscalationHandoff
        handoff={resolution({ fallbackLevel: "intent_with_host" })}
      />,
    );
    expect(
      screen.getByText(/derivando al anfitrión/i),
    ).toBeTruthy();
  });

  it("handles empty contacts gracefully (no crash)", () => {
    render(<EscalationHandoff handoff={resolution({ contacts: [] })} />);
    expect(
      screen.getByText(/No se encontraron contactos alcanzables/i),
    ).toBeTruthy();
  });

  it("shows Principal and 24/7 badges when flagged", () => {
    render(<EscalationHandoff handoff={resolution()} />);
    expect(screen.getByText("Principal")).toBeTruthy();
    expect(screen.getByText("24/7")).toBeTruthy();
  });

  it("disambiguates channel CTAs via aria-label (contact name + action)", () => {
    render(<EscalationHandoff handoff={resolution()} />);
    expect(screen.getByLabelText("Llamar a Cerrajero 24h")).toBeTruthy();
    expect(screen.getByLabelText("Abrir WhatsApp con Cerrajero 24h")).toBeTruthy();
  });
});
