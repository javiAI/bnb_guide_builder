"use client";
import * as React from "react";
import type {
  QuickActionKind,
  QuickActionResolved,
} from "@/config/registries/quick-action-registry";
import { buildTelHref } from "@/lib/contact-actions";
import { useGuideToast } from "./toast";

interface Props {
  action: QuickActionResolved;
}

const COPY_FAILURE_MESSAGE = "No se pudo copiar";

function hrefFor(kind: QuickActionKind, value: string): string | null {
  switch (kind) {
    case "tel":
      return buildTelHref(value);
    case "whatsapp":
      // Resolver already normalized to wa.me digits.
      return `https://wa.me/${value}`;
    case "maps":
      return value;
    case "anchor":
      return value;
    case "copy":
      return null;
  }
}

export function QuickActionButton({ action }: Props) {
  const { toast } = useGuideToast();

  const handleCopy = React.useCallback(
    async (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      try {
        await navigator.clipboard.writeText(action.value);
        toast(action.toastOnSuccess ?? "Copiado");
      } catch {
        toast(COPY_FAILURE_MESSAGE);
      }
    },
    [action, toast],
  );

  if (action.kind === "copy") {
    return (
      <button
        type="button"
        onClick={handleCopy}
        aria-label={action.ariaLabel}
        className="guide-quick-action"
      >
        <span className="guide-quick-action__label">{action.label}</span>
      </button>
    );
  }

  const href = hrefFor(action.kind, action.value);
  if (!href) return null;

  const externalLink = action.kind === "maps";

  return (
    <a
      href={href}
      aria-label={action.ariaLabel}
      className="guide-quick-action"
      {...(externalLink
        ? { target: "_blank", rel: "noopener noreferrer" }
        : {})}
    >
      <span className="guide-quick-action__label">{action.label}</span>
    </a>
  );
}
