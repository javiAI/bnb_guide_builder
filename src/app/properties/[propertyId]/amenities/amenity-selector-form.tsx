"use client";

import { useTransition } from "react";
import { toggleAmenityAction } from "@/lib/actions/editor.actions";
import Link from "next/link";

interface AmenityItem {
  id: string;
  label: string;
  description: string;
  recommended: boolean;
  enabled: boolean;
}

interface AmenityGroupData {
  id: string;
  label: string;
  description: string;
  items: AmenityItem[];
}

interface AmenitySelectorFormProps {
  propertyId: string;
  groups: AmenityGroupData[];
}

function AmenityChip({
  propertyId,
  item,
}: {
  propertyId: string;
  item: AmenityItem;
}) {
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    const formData = new FormData();
    formData.set("propertyId", propertyId);
    formData.set("amenityKey", item.id);
    formData.set("enabled", String(!item.enabled));

    startTransition(() => {
      toggleAmenityAction(null, formData);
    });
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleToggle}
        disabled={isPending}
        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
          item.enabled
            ? "border-[var(--color-primary-300)] bg-[var(--color-primary-50)] text-[var(--color-primary-700)]"
            : "border-[var(--color-neutral-200)] bg-white text-[var(--color-neutral-600)] hover:border-[var(--color-neutral-300)]"
        } ${isPending ? "opacity-50" : ""}`}
        title={item.description}
      >
        <span
          className={`inline-block h-3 w-3 rounded-sm border ${
            item.enabled
              ? "border-[var(--color-primary-500)] bg-[var(--color-primary-500)]"
              : "border-[var(--color-neutral-300)]"
          }`}
        >
          {item.enabled && (
            <svg viewBox="0 0 12 12" className="h-3 w-3 text-white">
              <path
                d="M3 6l2 2 4-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </span>
        {item.label}
        {item.recommended && !item.enabled && (
          <span className="text-[10px] text-[var(--color-primary-500)]">★</span>
        )}
      </button>
      {item.enabled && (
        <Link
          href={`/properties/${propertyId}/amenities/${item.id}`}
          className="text-xs text-[var(--color-primary-500)] hover:text-[var(--color-primary-600)]"
        >
          Editar
        </Link>
      )}
    </div>
  );
}

export function AmenitySelectorForm({
  propertyId,
  groups,
}: AmenitySelectorFormProps) {
  const totalEnabled = groups.reduce(
    (sum, g) => sum + g.items.filter((i) => i.enabled).length,
    0,
  );

  return (
    <div className="space-y-6">
      <p className="text-sm text-[var(--color-neutral-500)]">
        {totalEnabled} amenities seleccionados
      </p>

      {groups.map((group) => {
        const groupEnabled = group.items.filter((i) => i.enabled).length;
        return (
          <div
            key={group.id}
            className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-elevated)] p-5"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-[var(--foreground)]">
                  {group.label}
                </h2>
                <p className="mt-0.5 text-xs text-[var(--color-neutral-500)]">
                  {group.description}
                </p>
              </div>
              {groupEnabled > 0 && (
                <span className="text-xs text-[var(--color-primary-600)]">
                  {groupEnabled}/{group.items.length}
                </span>
              )}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {group.items.map((item) => (
                <AmenityChip
                  key={item.id}
                  propertyId={propertyId}
                  item={item}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
