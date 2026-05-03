"use client";

import { type MouseEvent, useEffect, useRef, useState } from "react";
import { QrCode, X } from "lucide-react";

interface QrModalButtonProps {
  url: string;
  qrSvg: string;
}

export function QrModalButton({ url, qrSvg }: QrModalButtonProps) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
    } else {
      if (typeof dialog.close === "function") dialog.close();
      else dialog.removeAttribute("open");
    }
  }, [open]);

  const handleDialogClick = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === dialogRef.current) setOpen(false);
  };

  const displayUrl = url.replace(/^https?:\/\//, "");

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Ampliar código QR"
        className="inline-flex items-center gap-1.5 rounded-[6px] px-1.5 py-1 text-[11px] font-medium text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-interactive-hover)] hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)]"
      >
        <QrCode size={12} aria-hidden="true" />
        Ampliar QR
      </button>

      <dialog
        ref={dialogRef}
        onClose={() => setOpen(false)}
        onClick={handleDialogClick}
        aria-labelledby="qr-modal-title"
        className="w-[calc(100%-32px)] max-w-[360px] rounded-[var(--radius-xl)] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] p-0 shadow-xl backdrop:bg-black/50"
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          margin: 0,
        }}
      >
        <div className="relative p-6">
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Cerrar"
            className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-[8px] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-interactive-hover)] hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)]"
          >
            <X size={16} aria-hidden="true" />
          </button>

          <h2
            id="qr-modal-title"
            className="text-[15px] font-semibold text-[var(--color-text-primary)]"
          >
            Código QR de la guía
          </h2>
          <p className="mt-1 text-[13px] text-[var(--color-text-secondary)]">
            Escanea este código con la cámara del huésped para abrir la guía.
          </p>

          <div className="mt-5 flex justify-center">
            <div
              role="img"
              aria-label="Código QR de la guía"
              className="rounded-[var(--radius-lg)] border border-[var(--color-border-default)] bg-white p-3 [&>svg]:block [&>svg]:h-[240px] [&>svg]:w-[240px]"
              dangerouslySetInnerHTML={{ __html: qrSvg }}
            />
          </div>

          <p className="mt-4 break-words text-center text-[12px] text-[var(--color-text-muted)]">
            {displayUrl}
          </p>
        </div>
      </dialog>
    </>
  );
}
