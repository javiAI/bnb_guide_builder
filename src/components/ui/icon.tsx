import {
  Check,
  CircleAlert,
  Info,
  Loader2,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import type { LucideProps } from "lucide-react";

export const ICONS = {
  check: Check,
  "circle-alert": CircleAlert,
  info: Info,
  loader: Loader2,
  trash: Trash2,
  "triangle-alert": TriangleAlert,
} as const;

export type IconName = keyof typeof ICONS;

type IconTone =
  | "default"
  | "muted"
  | "success"
  | "warning"
  | "error"
  | "info"
  | "primary"
  | "destructive";

const TONE_COLORS: Record<IconTone, string> = {
  default:     "--color-text-secondary",
  muted:       "--color-text-muted",
  success:     "--color-status-success-icon",
  warning:     "--color-status-warning-icon",
  error:       "--color-status-error-icon",
  info:        "--color-status-info-icon",
  primary:     "--color-action-primary",
  destructive: "--color-action-destructive",
};

type IconSize = "xs" | "sm" | "md" | "lg" | "xl";

const SIZE_VARS: Record<IconSize, string> = {
  xs: "var(--icon-size-xs)",
  sm: "var(--icon-size-sm)",
  md: "var(--icon-size-md)",
  lg: "var(--icon-size-lg)",
  xl: "var(--icon-size-xl)",
};

interface IconProps extends Omit<LucideProps, "size"> {
  name: IconName;
  size?: IconSize;
  tone?: IconTone;
}

export function Icon({ name, size = "md", tone = "default", style, ...props }: IconProps) {
  const IconComponent = ICONS[name];
  const sizeVar = SIZE_VARS[size];
  return (
    <IconComponent
      aria-hidden
      style={{
        width:      sizeVar,
        height:     sizeVar,
        color:      `var(${TONE_COLORS[tone]})`,
        flexShrink: 0,
        ...style,
      }}
      {...props}
    />
  );
}
