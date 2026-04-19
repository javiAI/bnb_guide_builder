import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, act, fireEvent, cleanup } from "@testing-library/react";
import { InstallNudge, NUDGE_STORAGE_PREFIX } from "@/components/public-guide/install-nudge";

const SLUG = "casa-claudia";

function readStored(): Record<string, unknown> | null {
  const raw = window.localStorage.getItem(NUDGE_STORAGE_PREFIX + SLUG);
  return raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
}

beforeEach(() => {
  window.localStorage.clear();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

describe("InstallNudge", () => {
  it("does not render on the very first visit (below threshold)", () => {
    render(<InstallNudge slug={SLUG} />);
    expect(screen.queryByRole("dialog")).toBeNull();
    const stored = readStored();
    expect(stored?.visits).toBe(1);
  });

  it("appears on the second visit and persists dismissal", () => {
    const { unmount } = render(<InstallNudge slug={SLUG} />);
    unmount();
    render(<InstallNudge slug={SLUG} />);
    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Guarda esta guía")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /ahora no/i }));
    expect(screen.queryByRole("dialog")).toBeNull();

    const stored = readStored();
    expect(typeof stored?.dismissedAt).toBe("number");
  });

  it("never re-shows once dismissedAt is set", () => {
    window.localStorage.setItem(
      NUDGE_STORAGE_PREFIX + SLUG,
      JSON.stringify({ visits: 5, cumulativeMs: 600_000, dismissedAt: Date.now(), installedAt: null }),
    );
    render(<InstallNudge slug={SLUG} />);
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("captures beforeinstallprompt and calls prompt() when the user clicks Instalar", async () => {
    window.localStorage.setItem(
      NUDGE_STORAGE_PREFIX + SLUG,
      JSON.stringify({ visits: 1, cumulativeMs: 0, dismissedAt: null, installedAt: null }),
    );
    render(<InstallNudge slug={SLUG} />);
    act(() => {
      vi.advanceTimersByTime(50);
    });

    const prompt = vi.fn().mockResolvedValue(undefined);
    const event = new Event("beforeinstallprompt") as Event & {
      prompt: () => Promise<void>;
      userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
      preventDefault: () => void;
    };
    event.prompt = prompt;
    event.userChoice = Promise.resolve({ outcome: "accepted" as const });

    act(() => {
      window.dispatchEvent(event);
    });

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    const installBtn = screen.getByRole("button", { name: /instalar|cómo añadir/i });
    await act(async () => {
      fireEvent.click(installBtn);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(prompt).toHaveBeenCalledOnce();
  });
});
