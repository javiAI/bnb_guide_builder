export function GuideNotAvailable() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
          Guía no disponible
        </h1>
        <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
          Esta guía no existe o ya no se encuentra publicada.
        </p>
      </div>
    </div>
  );
}
