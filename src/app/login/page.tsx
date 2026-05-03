"use client";

import { useState } from "react";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = () => {
    try {
      setLoading(true);
      setError(null);
      window.location.href = "/api/auth/google/login";
    } catch {
      setError("No se pudo iniciar sesión. Inténtalo de nuevo.");
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[var(--color-background-page)] px-4 py-12">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.015em] text-[var(--color-text-primary)]">
            Guide Builder
          </h1>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            Accede para gestionar tus propiedades y guías
          </p>
        </div>

        <div className="space-y-4">
          {error && (
            <div className="rounded-[var(--radius-md)] border border-[var(--color-status-error-border)] bg-[var(--color-status-error-bg)] px-4 py-3">
              <p className="text-sm text-[var(--color-status-error-text)]">{error}</p>
            </div>
          )}

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="flex min-h-[44px] w-full items-center justify-center gap-3 rounded-[var(--radius-sm)] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] px-4 py-2.5 text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-interactive-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"/>
              <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"/>
              <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z"/>
              <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z"/>
            </svg>
            {loading ? "Iniciando sesión…" : "Continuar con Google"}
          </button>
        </div>

        <p className="text-center text-xs text-[var(--color-text-muted)]">
          Al acceder aceptas los términos de uso del servicio.
        </p>
      </div>
    </div>
  );
}
