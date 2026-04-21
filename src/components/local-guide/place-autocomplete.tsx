"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useDeferredValue,
} from "react";
import { formatDistance, type PoiSuggestion } from "@/lib/services/places";

const DEBOUNCE_MS = 250;
const MIN_QUERY = 2;

export interface PlaceAutocompleteProps {
  propertyId: string;
  onSelect: (suggestion: PoiSuggestion) => void;
  onManualFallback?: () => void;
  placeholder?: string;
  className?: string;
}

type FetchState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok"; suggestions: PoiSuggestion[] }
  | { kind: "rate_limited"; retryAfter: number }
  | { kind: "provider_unavailable" }
  | { kind: "property_missing_coordinates" }
  | { kind: "error" };

export function PlaceAutocomplete({
  propertyId,
  onSelect,
  onManualFallback,
  placeholder = "Busca un lugar (ej: Bar El Rincón)",
  className,
}: PlaceAutocompleteProps) {
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query);
  const [state, setState] = useState<FetchState>({ kind: "idle" });
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const listboxId = useId();

  useEffect(() => {
    const trimmed = deferred.trim();
    if (trimmed.length < MIN_QUERY) {
      setState({ kind: "idle" });
      return;
    }

    const handle = setTimeout(() => {
      if (abortRef.current) abortRef.current.abort();
      const ctl = new AbortController();
      abortRef.current = ctl;
      setState({ kind: "loading" });

      fetch(
        `/api/properties/${encodeURIComponent(propertyId)}/places-search` +
          `?q=${encodeURIComponent(trimmed)}`,
        { signal: ctl.signal },
      )
        .then(async (res) => {
          if (res.status === 429) {
            const body = await res.json().catch(() => ({}));
            setState({
              kind: "rate_limited",
              retryAfter: body.retryAfterSeconds ?? 30,
            });
            return;
          }
          if (res.status === 502 || res.status === 503) {
            setState({ kind: "provider_unavailable" });
            return;
          }
          if (res.status === 409) {
            setState({ kind: "property_missing_coordinates" });
            return;
          }
          if (!res.ok) {
            setState({ kind: "error" });
            return;
          }
          const body = await res.json();
          const suggestions = Array.isArray(body.suggestions)
            ? (body.suggestions as PoiSuggestion[])
            : [];
          setState({ kind: "ok", suggestions });
          setHighlight(0);
        })
        .catch((err) => {
          if (err?.name === "AbortError") return;
          setState({ kind: "error" });
        });
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(handle);
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
    };
  }, [deferred, propertyId]);

  const select = useCallback(
    (s: PoiSuggestion) => {
      onSelect(s);
      setQuery("");
      setState({ kind: "idle" });
      setOpen(false);
    },
    [onSelect],
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (state.kind !== "ok" || state.suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => (h + 1) % state.suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight(
        (h) => (h - 1 + state.suggestions.length) % state.suggestions.length,
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      select(state.suggestions[highlight]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const inputClass =
    "block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--color-primary-400)] focus:outline-none";

  return (
    <div className={`relative ${className ?? ""}`}>
      <input
        type="text"
        role="combobox"
        aria-expanded={open && state.kind !== "idle"}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={
          state.kind === "ok" && state.suggestions.length > 0
            ? `${listboxId}-opt-${highlight}`
            : undefined
        }
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className={inputClass}
        autoComplete="off"
      />
      {open && (
        <PlaceAutocompleteList
          id={listboxId}
          state={state}
          highlight={highlight}
          onSelect={select}
          onManualFallback={onManualFallback}
        />
      )}
    </div>
  );
}

function PlaceAutocompleteList({
  id,
  state,
  highlight,
  onSelect,
  onManualFallback,
}: {
  id: string;
  state: FetchState;
  highlight: number;
  onSelect: (s: PoiSuggestion) => void;
  onManualFallback?: () => void;
}) {
  if (state.kind === "idle") return null;

  const shell =
    "absolute z-10 mt-1 w-full overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] shadow-sm";

  if (state.kind === "loading") {
    return (
      <div className={shell}>
        <p className="px-3 py-2 text-xs text-[var(--color-neutral-500)]">
          Buscando…
        </p>
      </div>
    );
  }

  if (state.kind === "rate_limited") {
    return (
      <div className={shell}>
        <p className="px-3 py-2 text-xs text-[var(--color-neutral-500)]">
          Demasiadas búsquedas. Vuelve a probar en{" "}
          {Math.max(1, state.retryAfter)} s.
        </p>
      </div>
    );
  }

  if (state.kind === "property_missing_coordinates") {
    return (
      <div className={shell}>
        <p className="px-3 py-2 text-xs text-[var(--color-neutral-500)]">
          La propiedad aún no tiene coordenadas. Configura la ubicación para
          buscar lugares cercanos.
        </p>
      </div>
    );
  }

  if (state.kind === "provider_unavailable" || state.kind === "error") {
    return (
      <div className={shell}>
        <p className="px-3 py-2 text-xs text-[var(--color-neutral-500)]">
          No se pudo conectar con el buscador.{" "}
          {onManualFallback && (
            <button
              type="button"
              onClick={onManualFallback}
              className="underline"
            >
              Añadir manualmente
            </button>
          )}
        </p>
      </div>
    );
  }

  if (state.suggestions.length === 0) {
    return (
      <div className={shell}>
        <p className="px-3 py-2 text-xs text-[var(--color-neutral-500)]">
          Sin resultados.{" "}
          {onManualFallback && (
            <button
              type="button"
              onClick={onManualFallback}
              className="underline"
            >
              Añadir manualmente
            </button>
          )}
        </p>
      </div>
    );
  }

  return (
    <ul id={id} role="listbox" className={shell}>
      {state.suggestions.map((s, i) => (
        <li
          key={`${s.provider}:${s.providerPlaceId}`}
          id={`${id}-opt-${i}`}
          role="option"
          aria-selected={i === highlight}
          onMouseDown={(e) => {
            // mousedown fires before input blur → prevents dropdown dismissal
            e.preventDefault();
            onSelect(s);
          }}
          className={
            "flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-sm " +
            (i === highlight
              ? "bg-[var(--color-primary-50)] text-[var(--foreground)]"
              : "text-[var(--foreground)] hover:bg-[var(--color-neutral-100)]")
          }
        >
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium">{s.name}</div>
            {s.address && (
              <div className="truncate text-xs text-[var(--color-neutral-500)]">
                {s.address}
              </div>
            )}
          </div>
          {typeof s.distanceMeters === "number" && (
            <span className="shrink-0 text-xs text-[var(--color-neutral-500)]">
              {formatDistance(s.distanceMeters)}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

