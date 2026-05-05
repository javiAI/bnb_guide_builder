"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { restoreSnapshotAction } from "@/lib/actions/wizard.actions";

interface WizardShellProps {
  currentStep: number;
  totalSteps: number;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  backHref?: string;
  sessionId?: string;
  maxStepReached?: number;
  snapshot?: Record<string, unknown>;
  snapshotStep?: number;
}

const STEP_LABELS = [
  "Tipo",
  "Ubicación",
  "Capacidad",
  "Acceso",
];

function stepHref(step: number, sessionId: string): string {
  const paths = [
    "/properties/new/step-1",
    "/properties/new/step-2",
    "/properties/new/step-3",
    "/properties/new/step-4",
  ];
  return `${paths[step - 1]}?sessionId=${sessionId}`;
}

export function WizardShell({
  currentStep,
  totalSteps,
  title,
  subtitle,
  children,
  backHref,
  sessionId,
  maxStepReached,
  snapshot,
  snapshotStep,
}: WizardShellProps) {
  const maxReached = maxStepReached ?? currentStep;
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const router = useRouter();

  async function handleCancel() {
    setCancelling(true);
    if (sessionId && snapshot) {
      await restoreSnapshotAction(sessionId, snapshot, snapshotStep ?? 1);
    }
    router.push("/");
  }

  function handleSaveAndExit() {
    const form = document.querySelector<HTMLFormElement>("form[data-wizard-form]");
    if (!form) { router.push("/"); return; }

    let field = form.querySelector<HTMLInputElement>("input[name='_saveAndExit']");
    if (!field) {
      field = document.createElement("input");
      field.type = "hidden";
      field.name = "_saveAndExit";
      form.appendChild(field);
    }
    field.value = "true";

    let stepField = form.querySelector<HTMLInputElement>("input[name='_currentStep']");
    if (!stepField) {
      stepField = document.createElement("input");
      stepField.type = "hidden";
      stepField.name = "_currentStep";
      form.appendChild(stepField);
    }
    stepField.value = String(currentStep);

    form.requestSubmit();
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      {/* Step indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between text-xs text-[var(--color-neutral-500)]">
          <span>
            Paso {currentStep} de {totalSteps}
          </span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSaveAndExit}
              className="text-[var(--color-neutral-500)] hover:text-[var(--color-neutral-700)]"
            >
              Guardar y salir
            </button>
            <span className="text-[var(--color-neutral-300)]">|</span>
            <button
              type="button"
              onClick={() => setShowCancelModal(true)}
              className="text-[var(--color-neutral-500)] hover:text-[var(--color-neutral-700)]"
            >
              Cancelar
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-3 flex gap-1.5">
          {Array.from({ length: totalSteps }, (_, i) => {
            const stepNum = i + 1;
            const isClickable = sessionId && stepNum <= maxReached && stepNum !== currentStep;
            const bar = (
              <div
                className={`h-1 flex-1 rounded-full transition-colors ${
                  i < currentStep
                    ? "bg-[var(--color-primary-500)]"
                    : i < maxReached
                      ? "bg-[var(--color-primary-300)]"
                      : "bg-[var(--color-neutral-200)]"
                } ${isClickable ? "cursor-pointer hover:opacity-80" : ""}`}
              />
            );
            if (isClickable) {
              return (
                <Link key={i} href={stepHref(stepNum, sessionId)} className="flex-1">
                  {bar}
                </Link>
              );
            }
            return <div key={i} className="flex-1">{bar}</div>;
          })}
        </div>

        {/* Step labels */}
        <div className="mt-2 flex gap-1.5">
          {STEP_LABELS.map((label, i) => {
            const stepNum = i + 1;
            const isClickable = sessionId && stepNum <= maxReached && stepNum !== currentStep;
            const cls = `flex-1 text-center text-[10px] ${
              i < currentStep
                ? "font-medium text-[var(--color-primary-600)]"
                : i < maxReached
                  ? "font-medium text-[var(--color-primary-400)]"
                  : "text-[var(--color-neutral-400)]"
            } ${isClickable ? "cursor-pointer hover:underline" : ""}`;

            if (isClickable) {
              return (
                <Link key={label} href={stepHref(stepNum, sessionId)} className={cls}>
                  {label}
                </Link>
              );
            }
            return <span key={label} className={cls}>{label}</span>;
          })}
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
            className="inline-flex items-center gap-1.5 text-sm text-[var(--color-neutral-500)] hover:text-[var(--color-neutral-700)]"
          >
            <ArrowLeft size={14} aria-hidden="true" />
            Volver
          </Link>
        </div>
      )}

      {/* Cancel confirmation modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-sm rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">
              ¿Cancelar configuración?
            </h2>
            <p className="mt-2 text-sm text-[var(--color-neutral-600)]">
              Todos los cambios realizados en esta sesión se descartarán y se volverá al último estado guardado.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                className="inline-flex min-h-[44px] items-center rounded-lg px-4 py-2 text-sm font-medium text-[var(--color-neutral-600)] hover:bg-[var(--color-neutral-100)] transition-colors"
              >
                Volver al wizard
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={cancelling}
                className="inline-flex min-h-[44px] items-center rounded-lg bg-[var(--color-status-error-solid)] px-4 py-2 text-sm font-medium text-[var(--color-status-error-solid-fg)] hover:opacity-90 disabled:opacity-40 transition-opacity"
              >
                {cancelling ? "Cancelando..." : "Sí, cancelar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
