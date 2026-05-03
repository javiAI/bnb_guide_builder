"use client";

import { useEffect, useRef, useState } from "react";
import { Copy, Check } from "lucide-react";

interface CopyLinkButtonProps {
  url: string;
  variant?: "primary" | "secondary" | "icon";
}

export function CopyLinkButton({ url, variant = "primary" }: CopyLinkButtonProps) {
  const [copied, setCopied] = useState(false);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current !== null) {
        clearTimeout(resetTimerRef.current);
        resetTimerRef.current = null;
      }
    };
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      if (resetTimerRef.current !== null) clearTimeout(resetTimerRef.current);
      resetTimerRef.current = setTimeout(() => {
        setCopied(false);
        resetTimerRef.current = null;
      }, 1800);
    } catch {
      setCopied(false);
    }
  };

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={handleCopy}
        aria-label={copied ? "Enlace copiado" : "Copiar enlace"}
        className="grid min-h-[44px] min-w-[44px] shrink-0 place-items-center rounded-[8px] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-interactive-hover)] hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)]"
      >
        {copied ? (
          <Check size={15} aria-hidden="true" className="text-[var(--color-status-success-solid)]" />
        ) : (
          <Copy size={15} aria-hidden="true" />
        )}
      </button>
    );
  }

  if (variant === "secondary") {
    return (
      <button
        type="button"
        onClick={handleCopy}
        aria-label={copied ? "Enlace copiado" : "Copiar enlace"}
        className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-[8px] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] px-3 text-[12px] font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-interactive-hover)] hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)]"
      >
        {copied ? (
          <>
            <Check size={12} aria-hidden="true" className="text-[var(--color-status-success-solid)]" />
            Copiado
          </>
        ) : (
          <>
            <Copy size={12} aria-hidden="true" />
            Copiar
          </>
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label="Copiar enlace"
      className="inline-flex flex-1 min-h-[44px] items-center justify-center gap-1.5 rounded-[8px] bg-[var(--color-action-primary)] px-3 py-1.5 text-[12px] font-medium text-[var(--color-action-primary-fg)] transition-colors hover:bg-[var(--color-action-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)]"
    >
      {copied ? (
        <>
          <Check size={12} aria-hidden="true" />
          Copiado
        </>
      ) : (
        <>
          <Copy size={12} aria-hidden="true" />
          Copiar
        </>
      )}
    </button>
  );
}
