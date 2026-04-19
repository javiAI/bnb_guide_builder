import { beforeAll, describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { GuideSearch } from "@/components/public-guide/guide-search";
import type { GuideSearchIndex } from "@/lib/types/guide-search-hit";

function baseIndex(): GuideSearchIndex {
  return {
    buildVersion: "test-0000000",
    entries: [
      {
        id: "item-am.wifi",
        anchor: "item-am.wifi",
        sectionId: "gs.amenities",
        sectionLabel: "Equipamiento",
        label: "Wi-Fi",
        snippet: "Red CasaClaudia · welcome2026",
        keywords: "Wi-Fi Red CasaClaudia welcome2026 wifi internet contraseña red",
      },
      {
        id: "item-am.parking",
        anchor: "item-am.parking",
        sectionId: "gs.amenities",
        sectionLabel: "Equipamiento",
        label: "Parking",
        snippet: "Plaza 12, planta -1",
        keywords: "Parking aparcamiento plaza",
      },
      {
        id: "item-pol.checkout",
        anchor: "item-pol.checkout",
        sectionId: "gs.checkout",
        sectionLabel: "Salida",
        label: "Check-out",
        snippet: "Hasta las 11:00",
        keywords: "Check-out salida",
      },
    ],
  };
}

beforeAll(() => {
  // Radix Dialog uses hasPointerCapture; jsdom lacks it.
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
  }
});

beforeEach(() => {
  // Clean up DOM from previous test
  document.body.innerHTML = "";
});

function openDialog() {
  fireEvent.click(screen.getByRole("button", { name: "Buscar en la guía" }));
}

async function typeQuery(value: string) {
  const input = screen.getByRole("searchbox", {
    name: "Buscar en la guía",
  }) as HTMLInputElement;
  await act(async () => {
    fireEvent.change(input, { target: { value } });
  });
  // flush useDeferredValue
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
  return input;
}

describe("<GuideSearch />", () => {
  it("renders trigger and is closed by default", () => {
    render(<GuideSearch index={baseIndex()} />);
    expect(
      screen.getByRole("button", { name: "Buscar en la guía" }),
    ).toBeTruthy();
    expect(screen.queryByRole("searchbox")).toBeNull();
  });

  it("opens when the user presses '/'", () => {
    render(<GuideSearch index={baseIndex()} />);
    fireEvent.keyDown(window, { key: "/" });
    expect(
      screen.getByRole("searchbox", { name: "Buscar en la guía" }),
    ).toBeTruthy();
  });

  it("'/' ignored when typing in an input elsewhere", () => {
    const other = document.createElement("input");
    document.body.appendChild(other);
    other.focus();
    render(<GuideSearch index={baseIndex()} />);
    fireEvent.keyDown(other, { key: "/" });
    expect(screen.queryByRole("searchbox")).toBeNull();
  });

  it("closes on Escape", () => {
    render(<GuideSearch index={baseIndex()} />);
    openDialog();
    expect(screen.getByRole("searchbox")).toBeTruthy();
    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "Escape",
    });
    expect(screen.queryByRole("searchbox")).toBeNull();
  });

  it("filters results live and shows matches", async () => {
    render(<GuideSearch index={baseIndex()} />);
    openDialog();
    await typeQuery("wifi");
    const list = screen.getByRole("listbox");
    const options = list.querySelectorAll('[role="option"]');
    expect(options.length).toBeGreaterThanOrEqual(1);
    expect(options[0].textContent).toContain("Wi-Fi");
    expect(options[0].textContent).toContain("Equipamiento");
  });

  it("Enter navigates to the first hit and closes the dialog", async () => {
    render(<GuideSearch index={baseIndex()} />);
    const target = document.createElement("section");
    target.id = "item-am.wifi";
    document.body.appendChild(target);

    openDialog();
    const input = await typeQuery("wifi");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.queryByRole("searchbox")).toBeNull();
    expect(window.location.hash).toBe("#item-am.wifi");
  });

  it("ArrowDown shifts aria-selected to the next option", async () => {
    // Use a 3-entry fixture where the query matches multiple hits so
    // selection movement is observable in the DOM.
    const index: GuideSearchIndex = {
      buildVersion: "aaaaaaaaaaaa",
      entries: [
        {
          id: "item-a",
          anchor: "item-a",
          sectionId: "gs.amenities",
          sectionLabel: "Equipamiento",
          label: "Alfa",
          snippet: "uno",
          keywords: "Alfa uno letra común",
        },
        {
          id: "item-b",
          anchor: "item-b",
          sectionId: "gs.amenities",
          sectionLabel: "Equipamiento",
          label: "Beta",
          snippet: "dos",
          keywords: "Beta dos letra común",
        },
        {
          id: "item-c",
          anchor: "item-c",
          sectionId: "gs.amenities",
          sectionLabel: "Equipamiento",
          label: "Gamma",
          snippet: "tres",
          keywords: "Gamma tres letra común",
        },
      ],
    };
    render(<GuideSearch index={index} />);
    openDialog();
    const input = await typeQuery("letra");
    const options = screen
      .getByRole("listbox")
      .querySelectorAll('[role="option"]');
    expect(options.length).toBeGreaterThanOrEqual(2);
    expect(options[0].getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    const after = screen
      .getByRole("listbox")
      .querySelectorAll('[role="option"]');
    expect(after[0].getAttribute("aria-selected")).toBe("false");
    expect(after[1].getAttribute("aria-selected")).toBe("true");
  });

  it("shows zero-result hint and logs a miss after debounce", async () => {
    vi.useFakeTimers();
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    render(<GuideSearch index={baseIndex()} />);
    openDialog();
    const input = screen.getByRole("searchbox") as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { value: "xyzzy" } });
    });
    // Run all timers — useDeferredValue + debounce
    await act(async () => {
      vi.runAllTimers();
    });
    expect(screen.getByRole("status").textContent).toMatch(/Nada coincide/i);
    const missCall = info.mock.calls.find((c) =>
      String(c[0] ?? "").includes("search-miss"),
    );
    expect(missCall).toBeDefined();
    expect((missCall?.[1] as { query?: string })?.query).toBe("xyzzy");
    info.mockRestore();
    vi.useRealTimers();
  });
});
