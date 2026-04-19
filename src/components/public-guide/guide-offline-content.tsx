export function GuideOfflineContent() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-bold text-[var(--foreground)]">
          Sin conexión
        </h1>
        <p className="mt-3 text-sm text-[var(--color-neutral-500)]">
          Estás sin conexión. Las secciones esenciales de la guía (Wi-Fi,
          llegada, check-out y emergencias) están disponibles aunque no tengas red.
        </p>
      </div>
    </div>
  );
}
