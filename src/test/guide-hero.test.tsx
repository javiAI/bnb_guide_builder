import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { GuideRenderer } from "@/components/public-guide/guide-renderer";
import { selectHeroAnswers } from "@/components/public-guide/guide-hero";
import { normalizeGuideForPresentation } from "@/lib/services/guide-presentation.service";
import { buildRichTree } from "@/test/fixtures/e2e/rich-tree";
import type { GuideItem, GuideTree } from "@/lib/types/guide-tree";

// jsdom does not implement IntersectionObserver (guide-toc scrollspy).
// The hero doesn't need it; the polyfill is just here so GuideRenderer mounts.
beforeAll(() => {
  if (typeof IntersectionObserver === "undefined") {
    class IO {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [] as IntersectionObserverEntry[];
      }
    }
    (globalThis as { IntersectionObserver: unknown }).IntersectionObserver = IO;
  }
});

function guestTreeFromRich(): GuideTree {
  const raw = buildRichTree();
  return normalizeGuideForPresentation({ ...raw, audience: "guest" }, "guest");
}

describe("GuideHero", () => {
  it("renders the hero section above other sections", () => {
    const tree = guestTreeFromRich();
    render(<GuideRenderer tree={tree} propertyTitle="Casa Claudia" />);
    const sections = document.querySelectorAll("section.guide-section");
    const ids = Array.from(sections).map((s) => s.id);
    expect(ids[0]).toBe("gs.essentials");
    const hero = document.getElementById("gs.essentials")!;
    expect(hero).toHaveClass("guide-section--hero");
  });

  it("renders essential items inside the hero", () => {
    const tree = guestTreeFromRich();
    render(<GuideRenderer tree={tree} propertyTitle="Casa Claudia" />);
    const hero = document.getElementById("gs.essentials")!;
    expect(hero.querySelector("#item-essentials\\.amenities\\.am\\.wifi")).toBeTruthy();
    expect(hero.querySelector("#item-essentials\\.arrival\\.arrival\\.location")).toBeTruthy();
  });

  it("renders quick-action buttons with min 44×44 targets", () => {
    const tree = guestTreeFromRich();
    render(<GuideRenderer tree={tree} propertyTitle="Casa Claudia" />);
    const wifiBtn = screen.getByRole("button", { name: "Copiar contraseña del Wi-Fi" });
    expect(wifiBtn).toHaveClass("guide-quick-action");
    const tel = screen.getByRole("link", { name: "Llamar al anfitrión" });
    expect(tel).toHaveAttribute("href", "tel:+34600111222");
    const wa = screen.getByRole("link", { name: "Enviar WhatsApp al anfitrión" });
    expect(wa).toHaveAttribute("href", "https://wa.me/34600111222");
    const maps = screen.getByRole("link", { name: "Abrir la dirección en Maps" });
    expect(maps.getAttribute("href")).toMatch(
      /^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=/,
    );
    const access = screen.getByRole("link", {
      name: "Ir a las instrucciones de entrada",
    });
    expect(access).toHaveAttribute("href", "#item-arrival.access");
  });

  it("copy button writes to clipboard + shows toast", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    const tree = guestTreeFromRich();
    render(<GuideRenderer tree={tree} propertyTitle="Casa Claudia" />);
    const btn = screen.getByRole("button", { name: "Copiar contraseña del Wi-Fi" });
    await act(async () => {
      fireEvent.click(btn);
    });
    expect(writeText).toHaveBeenCalledWith("welcome2026");
    await waitFor(() => {
      expect(screen.getByText("Contraseña copiada")).toBeInTheDocument();
    });
  });

  it("curates hero answers with access → wifi → location → operational priority", () => {
    const mk = (partial: Partial<GuideItem> & Pick<GuideItem, "id">): GuideItem => ({
      label: partial.id,
      taxonomyKey: null,
      value: null,
      visibility: "guest",
      deprecated: false,
      warnings: [],
      fields: [],
      media: [],
      children: [],
      ...partial,
    });
    const items: GuideItem[] = [
      mk({ id: "essentials.rules.pol.pets", taxonomyKey: "pol.pets" }),
      mk({ id: "essentials.amenities.am.wifi", taxonomyKey: "am.wifi" }),
      mk({ id: "essentials.rules.pol.quiet_hours", taxonomyKey: "pol.quiet_hours" }),
      mk({ id: "essentials.arrival.arrival.location" }),
      mk({ id: "essentials.arrival.arrival.access", taxonomyKey: "am.smartlock" }),
      mk({ id: "essentials.amenities.am.parking", taxonomyKey: "am.parking" }),
    ];
    const picked = selectHeroAnswers(items, 4).map((it) => it.id);
    expect(picked).toEqual([
      "essentials.arrival.arrival.access",
      "essentials.amenities.am.wifi",
      "essentials.arrival.arrival.location",
      "essentials.amenities.am.parking",
    ]);
  });

  it("selectHeroAnswers falls back to aggregator order when preferred keys are absent", () => {
    const mk = (id: string, taxonomyKey: string | null = null): GuideItem => ({
      id,
      label: id,
      taxonomyKey,
      value: null,
      visibility: "guest",
      deprecated: false,
      warnings: [],
      fields: [],
      media: [],
      children: [],
    });
    const items: GuideItem[] = [
      mk("a", "pol.no_noise"),
      mk("b", "am.coffee"),
      mk("c"),
    ];
    const picked = selectHeroAnswers(items, 4).map((it) => it.id);
    expect(picked).toEqual(["a", "b", "c"]);
  });

  it("omits a quick action when its data is missing", () => {
    const raw = buildRichTree();
    const pruned: GuideTree = {
      ...raw,
      sections: raw.sections.map((section) =>
        section.id === "gs.emergency"
          ? { ...section, items: [] }
          : section,
      ),
    };
    const tree = normalizeGuideForPresentation({ ...pruned, audience: "guest" }, "guest");
    render(<GuideRenderer tree={tree} propertyTitle="Casa Claudia" />);
    expect(screen.queryByRole("link", { name: "Llamar al anfitrión" })).toBeNull();
    expect(
      screen.queryByRole("link", { name: "Enviar WhatsApp al anfitrión" }),
    ).toBeNull();
  });
});
