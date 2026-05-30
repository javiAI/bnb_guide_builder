import type { SystemStatus } from "./system-status";

/**
 * Circular completeness ring (Liora 16E.5 — ports the kit's `ring-pct`).
 * Pure SVG, semantic tokens only (no kit primitives like --moss-500). The
 * SVG is decorative (aria-hidden); the percentage is announced via the
 * sibling text node so the readout stays accessible.
 *
 * Subtypeless systems pass pct=null and render "Activo" instead of a ring (Q4).
 */
const RADIUS = 10;
const CIRC = 2 * Math.PI * RADIUS; // ≈ 62.83

const PROGRESS_STROKE: Record<SystemStatus, string> = {
  configured: "var(--color-status-success-solid)",
  incomplete: "var(--color-status-warning-solid)",
  empty: "var(--color-border-strong)",
};

const LABEL_TONE: Record<SystemStatus, string> = {
  configured: "text-[var(--color-status-success-text)]",
  incomplete: "text-[var(--color-status-warning-text)]",
  empty: "text-[var(--color-text-muted)]",
};

interface SystemRingProps {
  pct: number;
  status: SystemStatus;
}

export function SystemRing({ pct, status }: SystemRingProps) {
  const clamped = Math.max(0, Math.min(100, pct));
  const offset = CIRC * (1 - clamped / 100);
  return (
    <span className="inline-flex flex-col items-center gap-1">
      <svg
        viewBox="0 0 24 24"
        className="h-9 w-9"
        aria-hidden="true"
      >
        <circle
          cx="12"
          cy="12"
          r={RADIUS}
          fill="none"
          stroke="var(--color-progress-track)"
          strokeWidth="2.4"
        />
        <circle
          cx="12"
          cy="12"
          r={RADIUS}
          fill="none"
          stroke={PROGRESS_STROKE[status]}
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeDasharray={CIRC}
          strokeDashoffset={offset}
          transform="rotate(-90 12 12)"
        />
      </svg>
      <span className={`text-[11px] font-semibold tabular-nums ${LABEL_TONE[status]}`}>
        {clamped}%
      </span>
    </span>
  );
}
