import { Icon } from "./icon";

type SaveStatus = "saving" | "saved" | "error";

const statusConfig: Record<
  SaveStatus,
  { label: string; iconName: "loader" | "check" | "circle-alert"; tone: "muted" | "success" | "error"; spin?: boolean }
> = {
  saving: { label: "Guardando…",       iconName: "loader",       tone: "muted",   spin: true },
  saved:  { label: "Guardado",          iconName: "check",        tone: "success" },
  error:  { label: "Error al guardar",  iconName: "circle-alert", tone: "error" },
};

interface InlineSaveStatusProps {
  status: SaveStatus;
}

export function InlineSaveStatus({ status }: InlineSaveStatusProps) {
  const { label, iconName, tone, spin } = statusConfig[status];
  return (
    <span className="inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
      <Icon
        name={iconName}
        tone={tone}
        size="xs"
        className={spin ? "animate-spin" : undefined}
      />
      {label}
    </span>
  );
}
