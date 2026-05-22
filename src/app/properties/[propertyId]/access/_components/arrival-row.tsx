"use client";

import { Check, Move, Plus, Trash2, X, type LucideIcon } from "lucide-react";
import type { ArrivalMode } from "@/lib/services/arrival-discovery.service";
import { ARRIVAL_MODE_BG } from "./multi-pin-map";
import { PlaceListRow } from "./place-list-row";

export function ArrivalModeBadge({
  icon: Icon,
  mode,
}: {
  icon: LucideIcon;
  mode: ArrivalMode;
}) {
  return (
    <span
      aria-hidden="true"
      className="flex h-6 w-6 flex-none items-center justify-center rounded-full border-2 border-[var(--color-background-elevated)] text-[var(--color-background-elevated)] shadow-[var(--shadow-sm)]"
      style={{ backgroundColor: ARRIVAL_MODE_BG[mode] }}
    >
      <Icon size={12} strokeWidth={2} aria-hidden="true" />
    </span>
  );
}

export function ArrivalSuggestionRow({
  mode,
  icon,
  name,
  address,
  website,
  distanceMeters,
  onRename,
  onAdd,
  adding,
  onActivate,
  onDeactivate,
  isActive,
  disabled,
}: {
  mode: ArrivalMode;
  icon: LucideIcon;
  name: string;
  address: string | null;
  website: string | null;
  distanceMeters: number | null;
  onRename: (name: string) => void;
  onAdd: () => void;
  adding: boolean;
  onActivate: () => void;
  onDeactivate: () => void;
  isActive: boolean;
  disabled: boolean;
}) {
  return (
    <PlaceListRow
      leadingSlot={<ArrivalModeBadge icon={icon} mode={mode} />}
      name={name}
      address={address}
      website={website}
      distanceMeters={distanceMeters}
      onRename={onRename}
      trailingAction={{
        icon: Plus,
        label: `Añadir ${name}`,
        tone: "primary",
        onAction: onAdd,
        pending: adding,
      }}
      onActivate={onActivate}
      onDeactivate={onDeactivate}
      isActive={isActive}
      disabled={disabled}
    />
  );
}

/** Ephemeral draft row for click-to-place arrival pins (train / bus /
 * airport). Mirrors `DraftParkingRow` but uses the per-mode hue badge as
 * leadingSlot. Confirm commits via `addManualArrivalOptionAction`; X
 * cancels. */
export function ArrivalDraftRow({
  mode,
  icon,
  name,
  address,
  distanceMeters,
  resolving,
  onRename,
  onConfirm,
  onCancel,
  pending,
  disabled,
}: {
  mode: ArrivalMode;
  icon: LucideIcon;
  name: string;
  address: string | null;
  distanceMeters: number | null;
  resolving: boolean;
  onRename: (name: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  pending: boolean;
  disabled: boolean;
}) {
  const hasName = name.trim() !== "" && name.trim() !== "-";
  const placeholderName = resolving && !hasName ? "Detectando…" : "Añadir nombre";
  return (
    <PlaceListRow
      leadingSlot={<ArrivalModeBadge icon={icon} mode={mode} />}
      name={name}
      placeholderName={placeholderName}
      address={address}
      distanceMeters={distanceMeters}
      onRename={onRename}
      extraAction={{
        icon: X,
        label: "Cancelar",
        onAction: onCancel,
        tone: "neutral",
      }}
      trailingAction={{
        icon: Check,
        label: hasName ? "Confirmar" : "Añade un nombre para confirmar",
        tone: "primary",
        onAction: onConfirm,
        pending,
        disabled: !hasName,
      }}
      isActive
      disabled={disabled}
    />
  );
}

export function ArrivalConfirmedRow({
  mode,
  icon,
  name,
  address,
  distanceMeters,
  onRename,
  onDelete,
  onRelocateRequest,
  relocating,
  onActivate,
  onDeactivate,
  isActive,
  disabled,
}: {
  mode: ArrivalMode;
  icon: LucideIcon;
  name: string;
  address: string | null;
  distanceMeters: number | null;
  onRename: (name: string) => void;
  onDelete: () => void;
  onRelocateRequest: () => void;
  relocating: boolean;
  onActivate: () => void;
  onDeactivate: () => void;
  isActive: boolean;
  disabled: boolean;
}) {
  return (
    <PlaceListRow
      leadingSlot={<ArrivalModeBadge icon={icon} mode={mode} />}
      name={name}
      address={address}
      distanceMeters={distanceMeters}
      onRename={onRename}
      extraAction={{
        icon: Move,
        label: relocating ? "Cancelar mover" : `Mover ${name} en el mapa`,
        onAction: onRelocateRequest,
        tone: relocating ? "warning" : "neutral",
      }}
      trailingAction={{
        icon: Trash2,
        label: `Eliminar ${name}`,
        tone: "danger",
        onAction: onDelete,
      }}
      onActivate={onActivate}
      onDeactivate={onDeactivate}
      isActive={isActive || relocating}
      disabled={disabled}
    />
  );
}
