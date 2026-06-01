"use client";

import { useEffect, useState } from "react";
import { Sun, Moon, Monitor, type LucideIcon } from "lucide-react";
import { IconButton } from "@/components/ui/icon-button";
import { Tooltip } from "@/components/ui/tooltip";
import { THEME_STORAGE_KEY } from "@/lib/theme";

type Theme = "light" | "dark" | "auto";

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return "light";
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function readStoredTheme(): Theme {
  try {
    if (typeof localStorage === "undefined") return "auto";
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    if (v === "light" || v === "dark") return v;
  } catch {
    // localStorage blocked (private browsing, permissions) — fall through to auto
  }
  return "auto";
}

function applyTheme(theme: Theme) {
  if (typeof window === "undefined") return;
  const resolved = theme === "dark" ? "dark" : theme === "light" ? "light" : getSystemTheme();
  document.documentElement.setAttribute("data-theme", resolved);

  try {
    if (theme === "auto") {
      localStorage.removeItem(THEME_STORAGE_KEY);
    } else {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    }
  } catch {
    // localStorage blocked — data-theme is already set for this session
  }
}

// Cycle order: auto → light → dark → auto. `auto` follows the OS
// (prefers-color-scheme) — the sensible default; light/dark are explicit
// overrides persisted in localStorage.
const NEXT: Record<Theme, Theme> = { auto: "light", light: "dark", dark: "auto" };

const LABELS: Record<Theme, string> = {
  auto: "Tema automático",
  light: "Tema claro",
  dark: "Tema oscuro",
};

const ICONS: Record<Theme, LucideIcon> = {
  auto: Monitor,
  light: Sun,
  dark: Moon,
};

/**
 * Theme switcher (Liora 16F.5). A single icon button that cycles
 * auto → light → dark; the current mode shows on hover via the styled
 * `<Tooltip>` (placement="bottom" — it sits in the topbar). Matches the 32px
 * topbar icon buttons.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("auto");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setTheme(readStoredTheme());
    setHydrated(true);
  }, []);

  useEffect(() => {
    // Gate on hydrated: the useState default is "auto", so without this gate the
    // first render's effect would call applyTheme("auto") and erase a stored
    // "dark"/"light" before readStoredTheme() has settled into state.
    if (!hydrated || theme !== "auto") return;
    applyTheme("auto");
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme("auto");
    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
    mq.addListener(handler);
    return () => mq.removeListener(handler);
  }, [theme, hydrated]);

  const cycle = () => {
    const next = NEXT[theme];
    applyTheme(next);
    setTheme(next);
  };

  const Icon = ICONS[theme];

  return (
    <Tooltip text={LABELS[theme]} placement="bottom">
      <IconButton
        icon={Icon}
        iconSize={16}
        size="sm"
        tone="neutral"
        onClick={cycle}
        aria-label={LABELS[theme]}
      />
    </Tooltip>
  );
}
