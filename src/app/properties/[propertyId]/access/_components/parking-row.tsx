"use client";

import {
  Check,
  CircleHelp,
  CircleParking,
  Move,
  ParkingMeter,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";
import type { ParkingPlace } from "../access-form";
import { PlaceListRow } from "./place-list-row";
import type { BinaryFee } from "./use-parking-management";

/** Three-state cycle for the row fee toggle. The operator must actively
 * pick a state — we never silently default to "free". The cycle goes
 * unclassified → gratuito → de pago → unclassified again, so first click
 * always commits to a positive value the operator chose. */
export function cycleFee(current: BinaryFee | null): BinaryFee | null {
  if (current === null) return "free";
  if (current === "free") return "paid";
  return null;
}

/** Solid disc with the fee glyph, mirroring `multi-pin-map.tsx` so the
 * list and map stay in lockstep. Clickable — cycles fee on press. Confirmed
 * parking shares a single hue (blue) regardless of fee; the glyph (P vs
 * meter) distinguishes free from paid. */
function ParkingFeeBadge({
  fee,
  onToggle,
  disabled,
}: {
  fee: BinaryFee | null;
  onToggle: () => void;
  disabled: boolean;
}) {
  const Icon = fee === "free" ? CircleParking : fee === "paid" ? ParkingMeter : CircleHelp;
  const stateLabel =
    fee === "free" ? "Gratuito" : fee === "paid" ? "De pago" : "Sin clasificar";
  return (
    <Tooltip text={`${stateLabel} · pulsa para cambiar`}>
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        aria-label={`Cambiar tipo de aparcamiento (actual: ${stateLabel.toLowerCase()})`}
        className={cn(
          "flex h-6 w-6 flex-none items-center justify-center rounded-full border-2 transition-shadow duration-100",
          "border-[var(--color-background-elevated)] shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)]",
          fee !== null
            ? "bg-[var(--color-status-info-solid)] text-[var(--color-background-elevated)]"
            : "bg-[var(--color-background-muted)] text-[var(--color-text-muted)]",
          "disabled:cursor-not-allowed disabled:opacity-50",
        )}
      >
        <Icon size={14} strokeWidth={2.5} aria-hidden="true" />
      </button>
    </Tooltip>
  );
}

export function SuggestionRow({
  name,
  address,
  website,
  distanceMeters,
  fee,
  onRename,
  onToggleFee,
  onAdd,
  onActivate,
  onDeactivate,
  isActive,
  disabled,
}: {
  name: string;
  address: string | null;
  website: string | null;
  distanceMeters: number | null;
  fee: BinaryFee | null;
  onRename: (name: string) => void;
  onToggleFee: () => void;
  onAdd: () => void;
  onActivate: () => void;
  onDeactivate: () => void;
  isActive: boolean;
  disabled: boolean;
}) {
  return (
    <PlaceListRow
      leadingSlot={
        <ParkingFeeBadge fee={fee} onToggle={onToggleFee} disabled={disabled} />
      }
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
      }}
      onActivate={onActivate}
      onDeactivate={onDeactivate}
      isActive={isActive}
      disabled={disabled}
    />
  );
}

/** Ephemeral draft row rendered at the top of "Añadidos" while the operator
 * is composing a click-to-place parking pin. The pin lives in client state
 * only — Confirm (Check) commits it via `addManualParkingPlaceAction`; X
 * cancels. Name + fee remain editable; the address/distance auto-resolve
 * from the click coords. */
export function DraftParkingRow({
  name,
  address,
  distanceMeters,
  fee,
  resolving,
  onRename,
  onToggleFee,
  onConfirm,
  onCancel,
  pending,
  disabled,
}: {
  name: string;
  address: string | null;
  distanceMeters: number | null;
  fee: BinaryFee | null;
  resolving: boolean;
  onRename: (name: string) => void;
  onToggleFee: () => void;
  onConfirm: () => void;
  onCancel: () => void;
  pending: boolean;
  disabled: boolean;
}) {
  const hasName = name.trim() !== "" && name.trim() !== "-";
  const placeholderName = resolving && !hasName ? "Detectando…" : "Añadir nombre";
  return (
    <PlaceListRow
      leadingSlot={
        <ParkingFeeBadge fee={fee} onToggle={onToggleFee} disabled={disabled} />
      }
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

export function ConfirmedRow({
  place,
  onRename,
  onSetFee,
  onDelete,
  onRelocateRequest,
  relocating,
  onActivate,
  onDeactivate,
  isActive,
  disabled,
}: {
  place: ParkingPlace;
  onRename: (name: string) => void;
  onSetFee: (fee: BinaryFee | null) => void;
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
      leadingSlot={
        <ParkingFeeBadge
          fee={place.feeType}
          onToggle={() => onSetFee(cycleFee(place.feeType))}
          disabled={disabled}
        />
      }
      name={place.name}
      address={place.address}
      distanceMeters={place.distanceMeters}
      onRename={onRename}
      extraAction={{
        icon: Move,
        label: relocating
          ? "Cancelar mover"
          : `Mover ${place.name} en el mapa`,
        onAction: onRelocateRequest,
        tone: relocating ? "warning" : "neutral",
      }}
      trailingAction={{
        icon: Trash2,
        label: `Eliminar ${place.name}`,
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
