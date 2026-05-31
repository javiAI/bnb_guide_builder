"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import { Braces, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { IconButton } from "@/components/ui/icon-button";
import {
  messagingVariables,
  type MessagingVariableItem,
} from "@/lib/taxonomies/messaging-variables";
import { previewMessageTemplateAction } from "@/lib/actions/messaging.actions";
import type { TemplatePreviewState } from "@/lib/actions/messaging.actions";

interface MessageBodyEditorProps {
  propertyId: string;
  name: string;
  defaultValue?: string;
  required?: boolean;
  rows?: number;
  placeholder?: string;
  fieldError?: string;
}

const TEXTAREA_CLASS =
  "block w-full resize-y bg-transparent text-sm leading-relaxed text-[var(--color-text-primary)] placeholder:text-[var(--color-text-placeholder)] focus:outline-none";

const GROUPED_ITEMS: Array<{
  id: string;
  label: string;
  items: MessagingVariableItem[];
}> = messagingVariables.groups.map((g) => ({
  id: g.id,
  label: g.label,
  items: messagingVariables.items.filter((i) => i.group === g.id),
}));

const RESERVATION_HINT_ES =
  "Se resolverá al enviar con datos de la reserva.";

export function MessageBodyEditor({
  propertyId,
  name,
  defaultValue = "",
  required,
  rows = 6,
  placeholder,
  fieldError,
}: MessageBodyEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const pickerInputRef = useRef<HTMLInputElement | null>(null);
  // When the picker opens from typing `{{`, we capture the range of those
  // braces so the selection replaces them rather than nesting into
  // `{{{{var}}}}`. Null when opened via button or Ctrl/Cmd+Space.
  const triggerRangeRef = useRef<{ start: number; end: number } | null>(null);

  const [value, setValue] = useState(defaultValue);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");
  const [pickerIndex, setPickerIndex] = useState(0);

  const filteredFlat = useMemo(() => {
    const q = pickerQuery.trim().toLowerCase();
    if (!q) return messagingVariables.items;
    return messagingVariables.items.filter(
      (i) =>
        i.variable.toLowerCase().includes(q) ||
        i.label.toLowerCase().includes(q),
    );
  }, [pickerQuery]);

  useEffect(() => {
    if (pickerIndex > 0 && pickerIndex >= filteredFlat.length) {
      setPickerIndex(0);
    }
  }, [filteredFlat.length, pickerIndex]);

  const openPicker = useCallback(() => {
    setPickerOpen(true);
    setPickerQuery("");
    setPickerIndex(0);
    // Defer focus: picker input hasn't mounted yet this tick.
    requestAnimationFrame(() => pickerInputRef.current?.focus());
  }, []);

  const closePicker = useCallback(() => {
    setPickerOpen(false);
    setPickerQuery("");
    triggerRangeRef.current = null;
    textareaRef.current?.focus();
  }, []);

  const insertVariable = useCallback(
    (variable: string) => {
      const ta = textareaRef.current;
      if (!ta) return;
      const token = `{{${variable}}}`;
      const trigger = triggerRangeRef.current;
      const start = trigger ? trigger.start : ta.selectionStart ?? value.length;
      const end = trigger ? trigger.end : ta.selectionEnd ?? value.length;
      const next = value.slice(0, start) + token + value.slice(end);
      setValue(next);
      requestAnimationFrame(() => {
        ta.focus();
        const cursor = start + token.length;
        ta.setSelectionRange(cursor, cursor);
      });
      closePicker();
    },
    [closePicker, value],
  );

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const next = e.target.value;
    setValue(next);
    const caret = e.target.selectionStart ?? 0;
    if (
      !pickerOpen &&
      caret >= 2 &&
      next.slice(caret - 2, caret) === "{{" &&
      !/[a-zA-Z_]/.test(next.charAt(caret) || "")
    ) {
      triggerRangeRef.current = { start: caret - 2, end: caret };
      openPicker();
    }
  };

  const handleTextareaKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === " ") {
      e.preventDefault();
      openPicker();
    }
  };

  const handlePickerKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      closePicker();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setPickerIndex((i) => Math.min(filteredFlat.length - 1, i + 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setPickerIndex((i) => Math.max(0, i - 1));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const sel = filteredFlat[pickerIndex];
      if (sel) insertVariable(sel.variable);
      return;
    }
  };

  return (
    <div className="space-y-2">
      <span className="text-xs font-medium text-[var(--color-text-secondary)]">
        Contenido {required ? "*" : ""}
      </span>

      {/* Composer: rounded box, borderless textarea + tool-row (no send / no
          AI toggle — the autonomous-send composer is aspirational, see
          docs/FUTURE.md § messaging-composer-tools). */}
      <div className="rounded-[14px] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] px-3.5 py-3 transition-colors focus-within:border-[var(--color-border-focus)] focus-within:ring-2 focus-within:ring-[var(--color-border-focus)]">
        <textarea
          ref={textareaRef}
          name={name}
          required={required}
          rows={rows}
          placeholder={placeholder}
          value={value}
          onChange={handleChange}
          onKeyDown={handleTextareaKeyDown}
          className={TEXTAREA_CLASS}
        />
        <div className="mt-2 flex items-center justify-between border-t border-[var(--color-border-subtle)] pt-2">
          <span className="text-[11px] text-[var(--color-text-muted)]">
            Usa <code className="rounded bg-[var(--color-background-muted)] px-1 py-0.5 text-[var(--color-text-primary)]">{`{{variable}}`}</code> para datos dinámicos
          </span>
          <button
            type="button"
            onClick={openPicker}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[var(--radius-md)] px-2.5 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-interactive-hover)] hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)]"
            aria-haspopup="listbox"
            aria-expanded={pickerOpen}
          >
            <Braces size={14} aria-hidden="true" />
            Insertar variable
          </button>
        </div>
      </div>

      {fieldError && (
        <p className="text-xs text-[var(--color-status-error-text)]">{fieldError}</p>
      )}

      {pickerOpen && (
        <VariablePicker
          inputRef={pickerInputRef}
          query={pickerQuery}
          onQueryChange={(q) => {
            setPickerQuery(q);
            setPickerIndex(0);
          }}
          activeIndex={pickerIndex}
          flat={filteredFlat}
          onSelect={insertVariable}
          onKeyDown={handlePickerKeyDown}
          onClose={closePicker}
        />
      )}

      <TemplatePreview propertyId={propertyId} body={value} />
    </div>
  );
}

// ─── Picker (combobox, ARIA listbox) ─────────────────────────────────────

interface VariablePickerProps {
  inputRef: React.RefObject<HTMLInputElement | null>;
  query: string;
  onQueryChange: (q: string) => void;
  activeIndex: number;
  flat: MessagingVariableItem[];
  onSelect: (variable: string) => void;
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
  onClose: () => void;
}

function VariablePicker({
  inputRef,
  query,
  onQueryChange,
  activeIndex,
  flat,
  onSelect,
  onKeyDown,
  onClose,
}: VariablePickerProps) {
  const listId = useId();

  const grouped = useMemo(() => {
    const byGroup = new Map<string, MessagingVariableItem[]>();
    for (const item of flat) {
      const list = byGroup.get(item.group);
      if (list) list.push(item);
      else byGroup.set(item.group, [item]);
    }
    return GROUPED_ITEMS.filter((g) => byGroup.has(g.id)).map((g) => ({
      ...g,
      items: byGroup.get(g.id) ?? [],
    }));
  }, [flat]);

  const activeVariable = flat[activeIndex]?.variable;

  return (
    <div
      role="dialog"
      aria-label="Insertar variable"
      className="rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-background-elevated)] p-3 shadow-[var(--card-shadow)]"
    >
      <div className="flex items-center justify-between gap-2">
        <input
          ref={inputRef}
          type="text"
          value={query}
          placeholder="Filtrar variables…"
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={onKeyDown}
          role="combobox"
          aria-expanded
          aria-controls={listId}
          aria-autocomplete="list"
          className="flex-1 rounded-[var(--radius-sm)] border border-[var(--color-border-default)] bg-[var(--color-background-surface)] px-2.5 py-1.5 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-placeholder)] focus:border-[var(--color-border-focus)] focus:outline-none focus:ring-2 focus:ring-[var(--color-border-focus)]"
        />
        <IconButton
          icon={X}
          size="sm"
          onClick={onClose}
          aria-label="Cerrar selector de variables"
        />
      </div>

      {grouped.length === 0 ? (
        <p className="mt-2 px-1 py-2 text-xs text-[var(--color-text-muted)]">
          Sin coincidencias.
        </p>
      ) : (
        <div
          id={listId}
          role="listbox"
          aria-label="Variables disponibles"
          className="mt-2 max-h-64 overflow-y-auto"
        >
          {grouped.map((group) => (
            <div
              key={group.id}
              role="group"
              aria-label={group.label}
              className="mb-2 last:mb-0"
            >
              <p
                aria-hidden="true"
                className="mb-1 px-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]"
              >
                {group.label}
                {group.id === "reservation" && (
                  <span className="ml-1 font-normal normal-case text-[var(--color-text-muted)]">
                    · {RESERVATION_HINT_ES}
                  </span>
                )}
              </p>
              {group.items.map((item) => {
                const isActive = item.variable === activeVariable;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    onClick={() => onSelect(item.variable)}
                    className={`flex min-h-[44px] w-full items-start gap-2 rounded-[var(--radius-sm)] px-2 py-1.5 text-left text-xs transition-colors hover:bg-[var(--color-interactive-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)] ${
                      isActive ? "bg-[var(--color-interactive-selected)]" : ""
                    }`}
                  >
                    <code className="mt-0.5 rounded bg-[var(--color-background-muted)] px-1 py-0.5 text-[11px] text-[var(--color-text-primary)]">
                      {`{{${item.variable}}}`}
                    </code>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-[var(--color-text-primary)]">
                        {item.label}
                      </span>
                      <span className="block truncate text-[var(--color-text-muted)]">
                        {item.description}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Preview with real data (debounced) ──────────────────────────────────

interface TemplatePreviewProps {
  propertyId: string;
  body: string;
}

interface PreviewState {
  status: "idle" | "loading" | "ready" | "error";
  output?: string;
  states?: Record<string, TemplatePreviewState>;
  counts?: {
    resolved: number;
    missing: number;
    unknown: number;
    unresolvedContext: number;
  };
  error?: string;
}

export function TemplatePreview({ propertyId, body }: TemplatePreviewProps) {
  const [state, setState] = useState<PreviewState>({ status: "idle" });
  // Monotonic id per dispatched request; responses whose id no longer
  // matches the ref are stale (a newer request already superseded them).
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (body.trim().length === 0) {
      requestIdRef.current++;
      setState({ status: "idle" });
      return;
    }
    setState((s) =>
      s.status === "ready" ? { ...s, status: "loading" } : { status: "loading" },
    );

    const timer = setTimeout(async () => {
      const myId = ++requestIdRef.current;
      const result = await previewMessageTemplateAction(propertyId, body);
      if (myId !== requestIdRef.current) return;
      if (result.success) {
        setState({
          status: "ready",
          output: result.output,
          states: result.states,
          counts: result.counts,
        });
      } else {
        setState({ status: "error", error: result.error });
      }
    }, 400);

    return () => {
      clearTimeout(timer);
      // Intentional live-ref mutation — invalidates any in-flight response.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      requestIdRef.current++;
    };
  }, [body, propertyId]);

  if (state.status === "idle") return null;

  return (
    <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-background-subtle)] p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
          Preview con datos reales
        </span>
        {state.counts && <CountsBadges counts={state.counts} />}
      </div>

      {state.status === "loading" && (
        <p className="text-xs text-[var(--color-text-muted)]">Calculando…</p>
      )}
      {state.status === "error" && (
        <p className="text-xs text-[var(--color-status-error-text)]">
          Error: {state.error}
        </p>
      )}
      {state.status === "ready" && (
        <>
          <pre className="whitespace-pre-wrap break-words text-sm text-[var(--color-text-primary)]">
            {state.output}
          </pre>
          {state.states && <PreviewStateList states={state.states} />}
        </>
      )}
    </div>
  );
}

function CountsBadges({
  counts,
}: {
  counts: NonNullable<PreviewState["counts"]>;
}) {
  return (
    <div className="flex gap-1.5">
      {counts.resolved > 0 && (
        <Badge label={`${counts.resolved} OK`} tone="success" />
      )}
      {counts.missing > 0 && (
        <Badge label={`${counts.missing} falta datos`} tone="warning" />
      )}
      {counts.unresolvedContext > 0 && (
        <Badge label={`${counts.unresolvedContext} al enviar`} tone="neutral" />
      )}
      {counts.unknown > 0 && (
        <Badge label={`${counts.unknown} desconocidas`} tone="danger" />
      )}
    </div>
  );
}

function PreviewStateList({
  states,
}: {
  states: Record<string, TemplatePreviewState>;
}) {
  const entries = Object.entries(states).filter(
    ([, s]) => s.status !== "resolved",
  );
  if (entries.length === 0) return null;
  return (
    <ul className="mt-3 space-y-1 border-t border-[var(--color-border-subtle)] pt-2">
      {entries.map(([token, st]) => (
        <li key={token} className="text-xs">
          <code className="mr-1 rounded bg-[var(--color-background-muted)] px-1 py-0.5 text-[11px] text-[var(--color-text-primary)]">
            {`{{${token}}}`}
          </code>
          {st.status === "missing" && (
            <span className="text-[var(--color-status-warning-text)]">
              Falta en la propiedad ({st.label})
            </span>
          )}
          {st.status === "unresolved_context" && (
            <span className="text-[var(--color-text-muted)]">
              Se resuelve al enviar ({st.label})
            </span>
          )}
          {st.status === "unknown" && (
            <span className="text-[var(--color-status-error-text)]">
              Variable desconocida
              {st.suggestion ? ` — ¿quisiste decir {{${st.suggestion}}}?` : ""}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
