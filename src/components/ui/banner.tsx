import { X } from "lucide-react";
import { Icon, type IconName } from "./icon";

type BannerType = "info" | "warning" | "danger";

const typeConfig: Record<
  BannerType,
  { bg: string; border: string; icon: IconName; iconTone: "info" | "warning" | "error" }
> = {
  info: {
    bg:       "bg-[var(--color-status-info-bg)]",
    border:   "border-[var(--color-status-info-border)]",
    icon:     "info",
    iconTone: "info",
  },
  warning: {
    bg:       "bg-[var(--color-status-warning-bg)]",
    border:   "border-[var(--color-status-warning-border)]",
    icon:     "triangle-alert",
    iconTone: "warning",
  },
  danger: {
    bg:       "bg-[var(--color-status-error-bg)]",
    border:   "border-[var(--color-status-error-border)]",
    icon:     "circle-alert",
    iconTone: "error",
  },
};

interface BannerProps {
  type: BannerType;
  message: string;
  /** When provided, renders a dismiss (X) button on the right that calls this. */
  onDismiss?: () => void;
}

export function Banner({ type, message, onDismiss }: BannerProps) {
  const { bg, border, icon, iconTone } = typeConfig[type];
  return (
    <div
      className={`flex items-start gap-[var(--alert-gap)] rounded-[var(--alert-radius)] border-l-4 text-[var(--color-text-primary)] ${bg} ${border}`}
      style={{ padding: "var(--alert-padding)" }}
      role="alert"
    >
      <Icon name={icon} tone={iconTone} size="md" style={{ marginTop: "1px", flexShrink: 0 }} />
      <span className="flex-1 text-sm">{message}</span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Cerrar aviso"
          className="recipe-icon-btn-32 -mr-1 grid h-8 w-8 shrink-0 self-center place-items-center text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
        >
          <X size={16} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
