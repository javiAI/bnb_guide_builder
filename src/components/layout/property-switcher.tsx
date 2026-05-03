"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronsUpDown, Check, Plus } from "lucide-react";

export interface SwitchableProperty {
  id: string;
  propertyNickname: string;
  city: string | null;
  country: string | null;
}

interface PropertySwitcherProps {
  currentPropertyId: string;
  currentPropertyNickname: string;
  properties: SwitchableProperty[];
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase();
}

function locationLabel(p: SwitchableProperty): string {
  return [p.city, p.country].filter(Boolean).join(", ");
}

export function PropertySwitcher({
  currentPropertyId,
  currentPropertyNickname,
  properties,
}: PropertySwitcherProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative mx-3 my-3.5">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full min-h-[44px] items-center gap-2.5 rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-background-page)] px-3 py-2.5 text-left transition-colors hover:bg-[var(--color-interactive-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)]"
      >
        <span
          className="grid h-7 w-7 shrink-0 place-items-center rounded-[8px] bg-[var(--color-action-primary-subtle)] text-[11px] font-semibold text-[var(--color-action-primary-subtle-fg)]"
          aria-hidden="true"
        >
          {initials(currentPropertyNickname)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold leading-[16px] text-[var(--color-text-primary)]">
            {currentPropertyNickname}
          </span>
          <span className="block text-[11px] leading-[14px] text-[var(--color-text-muted)]">
            {properties.length === 1
              ? "1 propiedad"
              : `${properties.length} propiedades`}
          </span>
        </span>
        <ChevronsUpDown
          size={14}
          aria-hidden="true"
          className="shrink-0 text-[var(--color-text-muted)]"
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 right-0 top-[calc(100%+4px)] z-20 overflow-hidden rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] shadow-lg"
        >
          <ul className="max-h-[320px] overflow-y-auto py-1" role="none">
            {properties.map((p) => {
              const isCurrent = p.id === currentPropertyId;
              const loc = locationLabel(p);
              return (
                <li key={p.id} role="none">
                  <Link
                    role="menuitem"
                    href={`/properties/${p.id}`}
                    onClick={() => setOpen(false)}
                    className={`flex min-h-[44px] items-center gap-2.5 px-3 py-2 text-[13px] transition-colors hover:bg-[var(--color-interactive-hover)] ${
                      isCurrent ? "bg-[var(--color-interactive-selected)]" : ""
                    }`}
                  >
                    <span
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-[8px] bg-[var(--color-background-muted)] text-[11px] font-semibold text-[var(--color-text-secondary)]"
                      aria-hidden="true"
                    >
                      {initials(p.propertyNickname)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block truncate font-medium ${
                          isCurrent
                            ? "text-[var(--color-interactive-selected-fg)]"
                            : "text-[var(--color-text-primary)]"
                        }`}
                      >
                        {p.propertyNickname}
                      </span>
                      {loc && (
                        <span className="block truncate text-[11px] text-[var(--color-text-muted)]">
                          {loc}
                        </span>
                      )}
                    </span>
                    {isCurrent && (
                      <Check
                        size={14}
                        aria-hidden="true"
                        className="shrink-0 text-[var(--color-interactive-selected-fg)]"
                      />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="border-t border-[var(--color-border-default)]">
            <Link
              role="menuitem"
              href="/properties/new/welcome"
              onClick={() => setOpen(false)}
              className="flex min-h-[44px] items-center gap-2.5 px-3 py-2 text-[13px] font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-interactive-hover)] hover:text-[var(--color-text-primary)]"
            >
              <Plus size={14} aria-hidden="true" />
              Nueva propiedad
            </Link>
            <Link
              role="menuitem"
              href="/"
              onClick={() => setOpen(false)}
              className="flex min-h-[44px] items-center px-3 py-2 text-[12px] text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-interactive-hover)] hover:text-[var(--color-text-primary)]"
            >
              Ver todas las propiedades →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
