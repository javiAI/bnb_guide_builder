"use client";

import Link from "next/link";

interface WizardShellProps {
  currentStep: number;
  totalSteps: number;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onBack?: () => void;
  backHref?: string;
}

const STEP_LABELS = [
  "Tipo",
  "Ubicación",
  "Capacidad",
  "Llegada",
];

export function WizardShell({
  currentStep,
  totalSteps,
  title,
  subtitle,
  children,
  backHref,
}: WizardShellProps) {
  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      {/* Step indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between text-xs text-[var(--color-neutral-500)]">
          <span>
            Paso {currentStep} de {totalSteps}
          </span>
          <Link
            href="/"
            className="text-[var(--color-neutral-500)] hover:text-[var(--color-neutral-700)]"
          >
            Guardar y salir
          </Link>
        </div>

        {/* Progress bar */}
        <div className="mt-3 flex gap-1.5">
          {Array.from({ length: totalSteps }, (_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i < currentStep
                  ? "bg-[var(--color-primary-500)]"
                  : "bg-[var(--color-neutral-200)]"
              }`}
            />
          ))}
        </div>

        {/* Step labels */}
        <div className="mt-2 flex gap-1.5">
          {STEP_LABELS.map((label, i) => (
            <span
              key={label}
              className={`flex-1 text-center text-[10px] ${
                i < currentStep
                  ? "font-medium text-[var(--color-primary-600)]"
                  : "text-[var(--color-neutral-400)]"
              }`}
            >
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--foreground)]">{title}</h1>
        {subtitle && (
          <p className="mt-2 text-sm text-[var(--color-neutral-500)]">
            {subtitle}
          </p>
        )}
      </div>

      {/* Content */}
      <div className="mb-8">{children}</div>

      {/* Navigation */}
      {backHref && (
        <div className="mt-6">
          <Link
            href={backHref}
            className="text-sm text-[var(--color-neutral-500)] hover:text-[var(--color-neutral-700)]"
          >
            &larr; Volver
          </Link>
        </div>
      )}
    </div>
  );
}
