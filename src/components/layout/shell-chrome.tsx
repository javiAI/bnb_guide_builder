"use client";

import { useCallback, useEffect, useState } from "react";
import {
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";
import { IconButton } from "@/components/ui/icon-button";
import {
  NAV_COLLAPSED_KEY,
  RAIL_COLLAPSED_KEY,
  NAV_COLLAPSED_ATTR,
  RAIL_COLLAPSED_ATTR,
} from "@/lib/shell-prefs";

/**
 * Client island for the operator shell collapse state. The layout itself is
 * driven entirely by `html[data-nav-collapsed]` / `html[data-rail-collapsed]`
 * (see `src/styles/shell.css`) — these toggles only flip the attribute and
 * persist the choice. The attribute is also set pre-paint in `layout.tsx`, so
 * the collapsed layout never flashes; only the toggle glyph settles on hydrate.
 */
function useCollapsePref(storageKey: string, attr: string) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(document.documentElement.getAttribute(attr) === "true");
  }, [attr]);

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      document.documentElement.setAttribute(attr, next ? "true" : "false");
      try {
        window.localStorage.setItem(storageKey, next ? "true" : "false");
      } catch {
        // localStorage blocked — the attribute is set for this session anyway.
      }
      return next;
    });
  }, [storageKey, attr]);

  return { collapsed, toggle };
}

export function NavCollapseToggle() {
  const { collapsed, toggle } = useCollapsePref(NAV_COLLAPSED_KEY, NAV_COLLAPSED_ATTR);
  const label = collapsed ? "Expandir menú" : "Colapsar menú";
  return (
    <IconButton
      icon={collapsed ? PanelLeftOpen : PanelLeftClose}
      iconSize={16}
      size="md"
      tone="neutral"
      onClick={toggle}
      aria-label={label}
      aria-pressed={collapsed}
      title={label}
    />
  );
}

export function RailCollapseToggle() {
  const { collapsed, toggle } = useCollapsePref(RAIL_COLLAPSED_KEY, RAIL_COLLAPSED_ATTR);
  const label = collapsed
    ? "Mostrar panel de publicación"
    : "Ocultar panel de publicación";
  return (
    <IconButton
      icon={collapsed ? PanelRightOpen : PanelRightClose}
      iconSize={15}
      size="sm"
      tone="neutral"
      onClick={toggle}
      aria-label={label}
      aria-pressed={collapsed}
      title={label}
    />
  );
}
