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
}

export function Banner({ type, message }: BannerProps) {
  const { bg, border, icon, iconTone } = typeConfig[type];
  return (
    <div
      className={`flex items-start gap-[var(--alert-gap)] rounded-[var(--alert-radius)] border-l-4 text-[var(--color-text-primary)] ${bg} ${border}`}
      style={{ padding: "var(--alert-padding)" }}
      role="alert"
    >
      <Icon name={icon} tone={iconTone} size="md" style={{ marginTop: "1px", flexShrink: 0 }} />
      <span className="text-sm">{message}</span>
    </div>
  );
}
