import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import axe from "axe-core";
import { FieldInput, FieldSelect, FieldTextarea } from "@/components/ui/field";
import { RadioCardGroup } from "@/components/ui/radio-card-group";
import { CheckboxCardGroup } from "@/components/ui/checkbox-card-group";

afterEach(cleanup);

const BLOCKING = new Set(["serious", "critical"]);

async function blockingViolations(container: HTMLElement) {
  // jsdom has no layout, so color-contrast can't be evaluated (it needs canvas)
  // — disable it here; contrast is covered by the token/dark-parity gates and
  // the browser-level axe run. Structural rules (label association, aria
  // validity, nested-interactive, accessible names) still run.
  const results = await axe.run(container, {
    runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
    rules: { "color-contrast": { enabled: false } },
  });
  return results.violations
    .filter((v) => BLOCKING.has(v.impact ?? ""))
    .map((v) => `[${v.impact}] ${v.id}: ${v.help}`);
}

describe("field primitives — a11y (axe, jsdom)", () => {
  it("FieldInput/FieldSelect/FieldTextarea associate label + help and pass axe", async () => {
    const { container, getByLabelText } = render(
      <form aria-label="test">
        <FieldInput label="País" required value="España" onChange={() => {}} help="Ayuda país" />
        <FieldSelect label="Zona horaria" value="Europe/Madrid" onChange={() => {}}>
          <option value="Europe/Madrid">Madrid</option>
        </FieldSelect>
        <FieldTextarea label="Descripción" value="" onChange={() => {}} />
      </form>,
    );
    // Label association (htmlFor ↔ id) is what makes these queryable by label.
    expect(getByLabelText("País", { exact: false })).toBeTruthy();
    expect(getByLabelText("Zona horaria")).toBeTruthy();
    expect(getByLabelText("Descripción")).toBeTruthy();
    expect(await blockingViolations(container)).toEqual([]);
  });

  it("RadioCardGroup layout=grid has accessible radio names + passes axe", async () => {
    const { container } = render(
      <RadioCardGroup
        name="ptype"
        layout="grid"
        showRecommended={false}
        value="pt.apartment"
        onChange={() => {}}
        options={[
          { id: "pt.apartment", label: "Apartamento", description: "Piso en edificio" },
          { id: "pt.house", label: "Casa", description: "Vivienda independiente" },
        ]}
      />,
    );
    expect(await blockingViolations(container)).toEqual([]);
  });

  it("CheckboxCardGroup layout=grid has accessible checkbox names + passes axe", async () => {
    const { container } = render(
      <CheckboxCardGroup
        name="envs"
        layout="grid"
        showRecommended={false}
        value={["env.mountain"]}
        onChange={() => {}}
        options={[
          { id: "env.mountain", label: "Montaña", description: "Entorno de montaña" },
          { id: "env.ski", label: "Esquí", description: "Cerca de pistas" },
        ]}
      />,
    );
    expect(await blockingViolations(container)).toEqual([]);
  });
});
