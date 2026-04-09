type BannerType = "info" | "warning" | "danger";

const typeStyles: Record<BannerType, string> = {
  info: "bg-[var(--color-info-50)] border-[var(--color-info-500)] text-[var(--color-neutral-700)]",
  warning: "bg-[var(--color-warning-50)] border-[var(--color-warning-500)] text-[var(--color-neutral-700)]",
  danger: "bg-[var(--color-danger-50)] border-[var(--color-danger-500)] text-[var(--color-neutral-700)]",
};

interface BannerProps {
  type: BannerType;
  message: string;
}

export function Banner({ type, message }: BannerProps) {
  return (
    <div
      className={`rounded-[var(--radius-md)] border-l-4 p-4 text-sm ${typeStyles[type]}`}
      role="alert"
    >
      {message}
    </div>
  );
}
