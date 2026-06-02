import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { TextLink } from "@/components/ui/text-link";
import type { SectionScores } from "@/lib/services/completeness.service";
import type { ValidationFinding } from "@/lib/validations/cross-validations";
import { OVERVIEW_SECTIONS } from "./section-map";
import completenessRules from "../../../taxonomies/completeness_rules.json";

interface ReadinessHeroCardProps {
  propertyId: string;
  overall: number;
  publishable: boolean;
  usable: boolean;
  scores: SectionScores;
  blockers: ValidationFinding[];
  errors: ValidationFinding[];
}

const RING_RADIUS = 36;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function meterTone(score: number): "ok" | "warn" | "low" {
  const { usableMinScore, publishableMinScore } = completenessRules.thresholds;
  if (score >= publishableMinScore) return "ok";
  if (score >= usableMinScore) return "warn";
  return "low";
}

const TONE_BG: Record<"ok" | "warn" | "low", string> = {
  ok: "bg-[var(--color-status-success-solid)]",
  warn: "bg-[var(--color-status-warning-solid)]",
  low: "bg-[var(--color-status-error-solid)]",
};

interface ReadinessState {
  /** Short categorical tag for the status chip. */
  tag: string;
  tone: "success" | "warning" | "neutral";
  /** Descriptive headline. */
  label: string;
  detail: string;
}

function readinessState(
  publishable: boolean,
  usable: boolean,
  blockerCount: number,
): ReadinessState {
  if (publishable && blockerCount === 0) {
    return {
      tag: "Lista",
      tone: "success",
      label: "Tu guía está lista",
      detail: "Todo verificado. Puedes publicar y compartir el enlace ahora mismo.",
    };
  }
  if (usable && blockerCount > 0) {
    return {
      tag: "Casi lista",
      tone: "warning",
      label: "Casi lista",
      detail: `Quedan ${blockerCount} bloqueante${blockerCount === 1 ? "" : "s"} antes de una publicación óptima.`,
    };
  }
  if (usable) {
    return {
      tag: "Casi lista",
      tone: "warning",
      label: "Usable, sin pulir",
      detail: "Puedes compartirla, pero quedan secciones con baja completitud.",
    };
  }
  return {
    tag: "En progreso",
    tone: "neutral",
    label: "En progreso",
    detail: "Completa los campos pendientes para que la guía sea útil y legible para tus huéspedes.",
  };
}

export function ReadinessHeroCard({
  propertyId,
  overall,
  publishable,
  usable,
  scores,
  blockers,
  errors,
}: ReadinessHeroCardProps) {
  const issues = [...blockers, ...errors];
  const state = readinessState(publishable, usable, blockers.length);
  const offset = RING_CIRCUMFERENCE - (RING_CIRCUMFERENCE * overall) / 100;

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] p-5">
      <div className="flex flex-wrap items-start gap-x-6 gap-y-5">
        <div className="relative h-[88px] w-[88px] shrink-0">
          <svg viewBox="0 0 88 88" width="88" height="88" aria-hidden="true">
            <circle
              cx="44"
              cy="44"
              r={RING_RADIUS}
              fill="none"
              stroke="var(--color-border-subtle)"
              strokeWidth="6"
            />
            <circle
              cx="44"
              cy="44"
              r={RING_RADIUS}
              fill="none"
              stroke="var(--color-action-primary)"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={RING_CIRCUMFERENCE}
              strokeDashoffset={offset}
              transform="rotate(-90 44 44)"
            />
            <text
              x="44"
              y="49"
              textAnchor="middle"
              fontSize="18"
              fontWeight="700"
              fill="var(--color-text-primary)"
            >
              {overall}
            </text>
          </svg>
          <span className="sr-only">Completitud {overall} de 100</span>
        </div>

        <div className="min-w-[220px] max-w-[28rem]">
          <div className="flex items-center gap-2">
            <Badge label={state.tag} tone={state.tone} />
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
              Completitud · {overall} de 100
            </span>
          </div>
          <p className="mt-1.5 text-[20px] font-semibold leading-[1.2] tracking-[-0.01em] text-[var(--color-text-primary)]">
            {state.label}
          </p>
          <p className="mt-1 max-w-[52ch] text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
            {state.detail}
          </p>
        </div>

        <div className="flex min-w-[220px] flex-1 flex-col gap-2.5">
          {OVERVIEW_SECTIONS.map((section) => {
            const score = scores[section.key];
            const tone = meterTone(score);
            return (
              <Link
                key={section.key}
                href={`/properties/${propertyId}/${section.href}`}
                className="group flex min-h-[44px] items-center gap-2.5 rounded-[var(--radius-sm)] px-2 py-1 text-sm transition-colors hover:bg-[var(--color-interactive-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)]"
              >
                <span className="min-w-[36px] text-right font-medium tabular-nums text-[var(--color-text-primary)]">
                  {score}%
                </span>
                <span
                  className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--color-background-muted)]"
                  aria-hidden="true"
                >
                  <span
                    className={`absolute inset-y-0 left-0 ${TONE_BG[tone]}`}
                    style={{ width: `${score}%` }}
                  />
                </span>
                <span className="min-w-[88px] text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)]">
                  {section.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      {issues.length > 0 && (
        <div className="mt-5 rounded-[var(--radius-md)] border border-[var(--color-status-warning-border)] p-4">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-status-warning-text)]">
            <AlertTriangle size={13} aria-hidden="true" />
            {issues.length} {issues.length === 1 ? "incidencia pendiente" : "incidencias pendientes"}
          </p>
          <ul className="mt-2.5 space-y-2">
            {issues.slice(0, 3).map((f) => (
              <li
                key={f.id}
                className="flex items-start justify-between gap-3 text-[12px] leading-relaxed"
              >
                <span className="text-[var(--color-text-primary)]">{f.message}</span>
                {f.ctaUrl && (
                  <TextLink href={f.ctaUrl} size="sm" className="shrink-0">
                    {f.ctaLabel ?? "Ir"}
                  </TextLink>
                )}
              </li>
            ))}
          </ul>
          {issues.length > 3 && (
            <TextLink
              href={`/properties/${propertyId}/publishing`}
              size="sm"
              arrow
              className="mt-3 inline-flex"
            >
              Ver los {issues.length - 3} restantes
            </TextLink>
          )}
        </div>
      )}
    </div>
  );
}
