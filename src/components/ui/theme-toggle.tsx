"use client";

import { useEffect, useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { THEME_STORAGE_KEY } from "@/lib/theme";

type Theme = "light" | "dark" | "auto";

function readStoredTheme(): Theme {
  if (typeof localStorage === "undefined") return "auto";
  const v = localStorage.getItem(THEME_STORAGE_KEY);
  if (v === "light" || v === "dark") return v;
  return "auto";
}

function applyTheme(theme: Theme) {
  if (typeof window === "undefined") return;
  const resolved =
    theme === "dark"
      ? "dark"
      : theme === "light"
        ? "light"
        : window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
  document.documentElement.setAttribute("data-theme", resolved);

  if (theme === "auto") {
    localStorage.removeItem(THEME_STORAGE_KEY);
  } else {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }
}

const NEXT: Record<Theme, Theme> = { auto: "light", light: "dark", dark: "auto" };

const LABELS: Record<Theme, string> = {
  auto: "Tema automático",
  light: "Tema claro",
  dark: "Tema oscuro",
};

const ICONS: Record<Theme, React.ElementType> = {
  auto: Monitor,
  light: Sun,
  dark: Moon,
};

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("auto");

  useEffect(() => {
    setTheme(readStoredTheme());
  }, []);

  // Keep data-theme in sync with OS preference while in auto mode.
  useEffect(() => {
    if (theme !== "auto") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme("auto");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  const cycle = () => {
    const next = NEXT[theme];
    applyTheme(next);
    setTheme(next);
  };

  const Icon = ICONS[theme];

  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={LABELS[theme]}
      title={LABELS[theme]}
      className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-interactive-hover)] hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)]"
    >
      <Icon size={16} aria-hidden="true" />
    </button>
  );
}
