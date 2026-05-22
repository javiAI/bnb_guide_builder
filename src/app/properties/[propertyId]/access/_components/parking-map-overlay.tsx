"use client";

import { Move, X } from "lucide-react";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";
import { useParkingStateContext } from "./use-parking-management";

// Renders the "Pulsa para ubicar" relocate chip on top of any parking map
// (inline cockpit + lightbox). Manual parking-add is no longer surfaced here —
// the unified "+" picker on the cockpit MultiPinMap drives all manual placement
// (parking + transit modes), keyed by S02 toggles.

export function ParkingMapOverlay() {
  const parkingState = useParkingStateContext();
  if (!parkingState) return null;

  const { relocatingId, handleRelocateCancel } = parkingState;
  if (relocatingId === null) return null;

  return (
    <div
      className={cn(
        "pointer-events-auto absolute left-1/2 top-3 z-[2] flex -translate-x-1/2 items-center gap-1.5 rounded-full py-1 pl-2.5 pr-1",
        "bg-[var(--color-background-elevated)] shadow-[var(--shadow-md)]",
        "border border-[var(--color-border-default)]",
        "text-[12px] text-[var(--color-text-secondary)]",
      )}
    >
      <Move
        size={12}
        aria-hidden="true"
        className="text-[var(--color-status-warning-icon)]"
      />
      <span>Pulsa para ubicar</span>
      <Tooltip text="Cancelar">
        <button
          type="button"
          onClick={handleRelocateCancel}
          aria-label="Cancelar mover"
          className={cn(
            "recipe-icon-btn-32 inline-flex h-7 w-7 items-center justify-center rounded-full",
            "text-[var(--color-text-muted)] hover:bg-[var(--color-background-muted)] hover:text-[var(--color-text-secondary)]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)]",
          )}
        >
          <X size={13} aria-hidden="true" />
        </button>
      </Tooltip>
    </div>
  );
}
