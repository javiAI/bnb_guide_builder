"use client";

import { useEffect, useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";

type Theme = "light" | "dark" | "auto";

function readStoredTheme(): Theme {
  if (typeof localStorage === "undefined") return "auto";
  const v = localStorage.getItem("theme");
  if (v === "light" || v === "dark") return v;
  return "auto";
}

function applyTheme(theme: Theme) {
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
    localStorage.removeItem("theme");
  } else {
    localStorage.setItem("theme", theme);
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
