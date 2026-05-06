import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface MethodListProps {
  children: ReactNode;
  className?: string;
}

export function MethodList({ children, className }: MethodListProps) {
  return <div className={cn("flex flex-col gap-2", className)}>{children}</div>;
}
