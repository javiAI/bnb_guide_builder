"use client";

import { useEffect, useState } from "react";
import type { GuideAudience } from "@/lib/types/guide-tree";
type Format = "md" | "html" | "json";

const AUDIENCES: { id: GuideAudience; label: string }[] = [
  { id: "guest", label: "Huésped" },
  { id: "ai", label: "Asistente IA" },
  { id: "internal", label: "Interno" },
];

const FORMATS: { id: Format; label: string }[] = [
  { id: "md", label: "Markdown" },
  { id: "html", label: "HTML" },
  { id: "json", label: "JSON" },
];

interface GuidePreviewProps {
  propertyId: string;
}

export function GuidePreview({ propertyId }: GuidePreviewProps) {
  const [audience, setAudience] = useState<GuideAudience>("guest");
  const [format, setFormat] = useState<Format>("md");
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    fetch(
      `/api/properties/${encodeURIComponent(propertyId)}/guide?audience=${audience}&format=${format}`,
      { signal: controller.signal },
    )
      .then(async (res) => {
        if (controller.signal.aborted) return;
        if (!res.ok) {
          setError(`Error ${res.status}`);
          setContent("");
          return;
        }
        const text = await res.text();
        if (controller.signal.aborted) return;
        setContent(format === "json" ? JSON.stringify(JSON.parse(text), null, 2) : text);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Unknown error");
        setContent("");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [propertyId, audience, format]);

  const pdfHref = `/api/properties/${encodeURIComponent(propertyId)}/guide?audience=${audience}&format=pdf`;

  return (
    <div className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface-elevated)] p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[var(--foreground)]">
          Vista previa
        </h2>
        <a
          href={pdfHref}
          className="rounded-[var(--radius-md)] bg-[var(--color-primary-500)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--color-primary-600)]"
        >
          Descargar PDF
        </a>
      </div>

      <div className="mb-4 flex flex-wrap gap-4">
        <div>
          <span className="mb-1 block text-xs font-semibold text-[var(--color-neutral-600)]">
            Audiencia
          </span>
          <div className="flex gap-1">
            {AUDIENCES.map((a) => (
              <button
                key={a.id}
                type="button"
                aria-pressed={audience === a.id}
                onClick={() => setAudience(a.id)}
                className={`rounded-[var(--radius-md)] px-3 py-1.5 text-sm font-medium transition-colors ${
                  audience === a.id
                    ? "bg-[var(--color-primary-500)] text-white"
                    : "bg-[var(--color-neutral-100)] text-[var(--color-neutral-700)] hover:bg-[var(--color-neutral-200)]"
                }`}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="mb-1 block text-xs font-semibold text-[var(--color-neutral-600)]">
            Formato
          </span>
          <div className="flex gap-1">
            {FORMATS.map((f) => (
              <button
                key={f.id}
                type="button"
                aria-pressed={format === f.id}
                onClick={() => setFormat(f.id)}
                className={`rounded-[var(--radius-md)] px-3 py-1.5 text-sm font-medium transition-colors ${
                  format === f.id
                    ? "bg-[var(--color-primary-500)] text-white"
                    : "bg-[var(--color-neutral-100)] text-[var(--color-neutral-700)] hover:bg-[var(--color-neutral-200)]"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading && (
        <p className="text-sm text-[var(--color-neutral-500)]">Cargando…</p>
      )}
      {error && (
        <p className="text-sm text-[var(--color-error-600)]">{error}</p>
      )}
      {!loading && !error && format === "html" ? (
        <div
          className="prose max-w-none rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--background)] p-4 text-sm"
          dangerouslySetInnerHTML={{ __html: content }}
        />
      ) : (
        !loading &&
        !error && (
          <pre className="overflow-x-auto whitespace-pre-wrap rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--background)] p-4 text-xs text-[var(--foreground)]">
            {content}
          </pre>
        )
      )}
    </div>
  );
}
