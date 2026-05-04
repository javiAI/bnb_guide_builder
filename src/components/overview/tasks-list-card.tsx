import Link from "next/link";
import {
  Camera,
  FileText,
  Sparkles,
  Home,
  Zap,
  KeyRound,
  AlertCircle,
  ArrowRight,
  Target,
  type LucideIcon,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { SectionEyebrow } from "@/components/ui/section-eyebrow";
import { IconBadge, type IconBadgeTone } from "@/components/ui/icon-badge";
import type { SectionScores } from "@/lib/services/completeness.service";
import type { ValidationFinding } from "@/lib/validations/cross-validations";
import { OVERVIEW_SECTIONS } from "./section-map";
import completenessRules from "../../../taxonomies/completeness_rules.json";

interface TasksListCardProps {
  propertyId: string;
  scores: SectionScores;
  blockers: ValidationFinding[];
  errors: ValidationFinding[];
}

interface Task {
  id: string;
  title: string;
  sub: string;
  meta: string;
  ctaUrl: string;
  icon: LucideIcon;
  iconTone: Extract<IconBadgeTone, "primary" | "neutral" | "warning">;
  impact?: "Alto impacto" | "Impacto medio" | null;
}

const SECTION_ICON: Record<string, LucideIcon> = {
  spaces: Home,
  amenities: Sparkles,
  systems: Zap,
  arrival: KeyRound,
};

const SEVERITY_TASK_ICON: Record<string, LucideIcon> = {
  blocker: AlertCircle,
  error: FileText,
};

function buildTasks(
  propertyId: string,
  scores: SectionScores,
  blockers: ValidationFinding[],
  errors: ValidationFinding[],
): Task[] {
  const tasks: Task[] = [];

  for (const issue of blockers) {
    tasks.push({
      id: `blocker:${issue.id}`,
      title: issue.message,
      sub: "Resuelve este bloqueante para que la guía pueda publicarse.",
      meta: "Bloqueante",
      ctaUrl: issue.ctaUrl ?? `/properties/${propertyId}/publishing`,
      icon: SEVERITY_TASK_ICON.blocker ?? AlertCircle,
      iconTone: "warning",
      impact: "Alto impacto",
    });
  }

  for (const issue of errors) {
    tasks.push({
      id: `error:${issue.id}`,
      title: issue.message,
      sub: "Error de validación. Corrige antes de publicar.",
      meta: "Error",
      ctaUrl: issue.ctaUrl ?? `/properties/${propertyId}/publishing`,
      icon: SEVERITY_TASK_ICON.error ?? FileText,
      iconTone: "warning",
      impact: "Alto impacto",
    });
  }

  const ranked = [...OVERVIEW_SECTIONS].sort(
    (a, b) => scores[a.key] - scores[b.key],
  );
  for (const section of ranked) {
    const score = scores[section.key];
    if (score >= completenessRules.thresholds.publishableMinScore) continue;
    const isCritical = score < completenessRules.thresholds.usableMinScore;
    tasks.push({
      id: `section:${section.key}`,
      title: `Mejora ${section.label.toLowerCase()}`,
      sub: `Score actual: ${score}%. Completa los campos pendientes para desbloquear outputs.`,
      meta: section.label,
      ctaUrl: `/properties/${propertyId}/${section.href}`,
      icon: SECTION_ICON[section.key] ?? Camera,
      iconTone: isCritical ? "warning" : "primary",
      impact: isCritical ? "Alto impacto" : "Impacto medio",
    });
  }

  return tasks;
}

export function TasksListCard({
  propertyId,
  scores,
  blockers,
  errors,
}: TasksListCardProps) {
  const tasks = buildTasks(propertyId, scores, blockers, errors).slice(0, 3);

  return (
    <Card variant="overview">
      <div className="mb-3 flex items-start justify-between">
        <SectionEyebrow icon={Target}>Siguientes acciones</SectionEyebrow>
        <span className="text-[11px] text-[var(--color-text-muted)]">
          Priorizadas por impacto
        </span>
      </div>

      {tasks.length === 0 ? (
        <p className="text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
          Todo listo. No hay acciones pendientes.
        </p>
      ) : (
        <ul className="-mx-2 flex flex-1 flex-col">
          {tasks.map((task) => (
            <li key={task.id}>
              <Link
                href={task.ctaUrl}
                className="group flex min-h-[44px] items-start gap-3 rounded-[var(--radius-md)] px-2 py-3 transition-colors hover:bg-[var(--color-interactive-hover)]"
              >
                <IconBadge icon={task.icon} tone={task.iconTone} />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <p className="text-[13px] font-medium leading-snug text-[var(--color-text-primary)]">
                    {task.title}
                  </p>
                  <p className="text-[12px] leading-relaxed text-[var(--color-text-secondary)]">
                    {task.sub}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--color-text-muted)]">
                    <span>{task.meta}</span>
                    {task.impact && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span
                          className={
                            task.impact === "Alto impacto"
                              ? "font-medium text-[var(--color-action-primary)]"
                              : ""
                          }
                        >
                          {task.impact}
                        </span>
                      </>
                    )}
                  </p>
                </div>
                <ArrowRight
                  size={16}
                  aria-hidden="true"
                  className="mt-1 shrink-0 text-[var(--color-text-muted)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--color-text-primary)]"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
