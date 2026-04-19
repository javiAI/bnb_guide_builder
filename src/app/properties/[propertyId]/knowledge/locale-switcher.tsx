"use client";

import { useActionState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { regenerateLocaleAction } from "@/lib/actions/knowledge.actions";
import type { ActionResult } from "@/lib/types/action-result";
import type { LocaleStatus } from "@/lib/services/knowledge-i18n.service";

const LOCALE_LABEL: Record<string, string> = {
  es: "ES",
  en: "EN",
};

interface LocaleSwitcherProps {
  propertyId: string;
  activeLocale: string;
  localeStatuses: LocaleStatus[];
  defaultLocale: string;
  onLocaleChange: (locale: string) => void;
}

function GenerateLocaleButton({
  propertyId,
  locale,
}: {
  propertyId: string;
  locale: string;
}) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    regenerateLocaleAction,
    null,
  );
  return (
    <form action={action} className="inline-flex items-center">
      <input type="hidden" name="propertyId" value={propertyId} />
      <input type="hidden" name="locale" value={locale} />
      <button
        type="submit"
        disabled={pending}
        className="ml-1.5 rounded-[var(--radius-sm)] bg-[var(--color-primary-500)] px-2 py-0.5 text-xs font-medium text-white transition-colors hover:bg-[var(--color-primary-600)] disabled:opacity-50"
      >
        {pending ? "…" : "Generar"}
      </button>
      {state?.error && (
        <span className="ml-1 text-xs text-[var(--color-danger-600)]">{state.error}</span>
      )}
    </form>
  );
}

export function LocaleSwitcher({
  propertyId,
  activeLocale,
  localeStatuses,
  defaultLocale,
  onLocaleChange,
}: LocaleSwitcherProps) {
  return (
    <div className="flex items-center gap-1">
      {localeStatuses.map(({ locale, status }) => {
        const isActive = locale === activeLocale;
        const isDefault = locale === defaultLocale;
        const label = LOCALE_LABEL[locale] ?? locale.toUpperCase();
        return (
          <div key={locale} className="flex items-center">
            <button
              type="button"
              onClick={() => onLocaleChange(locale)}
              className={[
                "rounded-[var(--radius-md)] px-3 py-1.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-[var(--color-primary-500)] text-white"
                  : "border border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--foreground)] hover:bg-[var(--color-neutral-100)]",
              ].join(" ")}
            >
              {label}
              {!isDefault && status === "missing" && (
                <span className="ml-1 inline-block size-1.5 rounded-full bg-[var(--color-warning-500)]" />
              )}
              {!isDefault && status === "present" && (
                <span className="ml-1 inline-block size-1.5 rounded-full bg-[var(--color-success-500)]" />
              )}
            </button>
            {!isDefault && status === "missing" && !isActive && (
              <GenerateLocaleButton propertyId={propertyId} locale={locale} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function LocaleSwitcherClient({
  propertyId,
  defaultLocale,
  activeLocale,
  localeStatuses,
}: {
  propertyId: string;
  defaultLocale: string;
  activeLocale: string;
  localeStatuses: LocaleStatus[];
}) {
  const router = useRouter();
  const pathname = usePathname();

  function handleLocaleChange(locale: string) {
    const params = new URLSearchParams();
    if (locale !== defaultLocale) params.set("locale", locale);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <LocaleSwitcher
      propertyId={propertyId}
      activeLocale={activeLocale}
      localeStatuses={localeStatuses}
      defaultLocale={defaultLocale}
      onLocaleChange={handleLocaleChange}
    />
  );
}
