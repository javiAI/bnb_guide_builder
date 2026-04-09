type SaveStatus = "saving" | "saved" | "error";

const statusLabels: Record<SaveStatus, string> = {
  saving: "Guardando…",
  saved: "Guardado",
  error: "Error al guardar",
};

interface InlineSaveStatusProps {
  status: SaveStatus;
}

export function InlineSaveStatus({ status }: InlineSaveStatusProps) {
  return (
    <span
      className={`text-xs ${
        status === "error"
          ? "text-[var(--color-danger-500)]"
          : "text-[var(--color-neutral-500)]"
      }`}
    >
      {statusLabels[status]}
    </span>
  );
}
