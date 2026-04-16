"use client";

import { useState } from "react";

interface ShareableLinkProps {
  url: string;
  qrSvg: string;
}

export function ShareableLink({ url, qrSvg }: ShareableLinkProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select the input text for manual copy
      const input = document.querySelector<HTMLInputElement>(
        'input[data-shareable-url]',
      );
      if (input) {
        input.select();
        input.setSelectionRange(0, input.value.length);
      }
    }
  }

  return (
    <div className="mt-8 rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface-elevated)] p-6">
      <h2 className="text-lg font-semibold text-[var(--foreground)]">
        Link compartible
      </h2>
      <p className="mt-1 text-sm text-[var(--color-neutral-500)]">
        Envía este link a tus huéspedes. No necesitan cuenta para ver la guía.
      </p>

      <div className="mt-4 flex items-center gap-3">
        <input
          type="text"
          readOnly
          value={url}
          aria-label="URL de la guía compartible"
          data-shareable-url
          className="flex-1 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none"
        />
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 rounded-[var(--radius-md)] border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--color-primary-600)] transition-colors hover:bg-[var(--color-primary-50)]"
        >
          Abrir guía
        </a>
        <button
          type="button"
          onClick={handleCopy}
          className="shrink-0 rounded-[var(--radius-md)] bg-[var(--color-primary-500)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-primary-600)] transition-colors"
        >
          {copied ? "Copiado" : "Copiar"}
        </button>
      </div>

      <details className="mt-4">
        <summary className="cursor-pointer text-sm font-medium text-[var(--color-primary-600)] hover:underline">
          Mostrar código QR
        </summary>
        <div className="mt-3 flex justify-center">
          <div className="inline-block rounded-[var(--radius-lg)] border border-[var(--border)] bg-white p-4">
            <img
              src={`data:image/svg+xml;base64,${btoa(qrSvg)}`}
              alt="Código QR del link compartible"
              width={200}
              height={200}
            />
          </div>
        </div>
      </details>
    </div>
  );
}
