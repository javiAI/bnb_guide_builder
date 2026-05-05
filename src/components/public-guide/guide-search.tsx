"use client";

import * as Dialog from "@radix-ui/react-dialog";
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { FUSE_OPTIONS } from "@/lib/client/guide-search-index";
import { trackSearchMiss } from "@/lib/client/guide-analytics";
import type Fuse from "fuse.js";
import type {
  GuideSearchEntry,
  GuideSearchHit,
  GuideSearchIndex,
} from "@/lib/types/guide-search-hit";
import type {
  GuideSemanticHit,
  GuideSemanticSearchResponse,
} from "@/lib/services/guide-search.service";

type SemanticState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok"; hits: GuideSemanticHit[]; degraded: boolean }
  | { kind: "error" }
  | { kind: "rate-limited"; retryAfterSeconds: number };

interface Props {
  index: GuideSearchIndex;
  /** Public slug — required to call the semantic search endpoint. */
  slug: string;
}

const MAX_RESULTS = 8;
const ZERO_HINT =
  "Nada coincide. Prueba «wifi», «parking», «checkout», «llegada», «normas».";
const MISS_DEBOUNCE_MS = 600;
const SEMANTIC_WORDS_THRESHOLD = 4; // >4 words triggers the CTA
const SEMANTIC_FEW_HITS_THRESHOLD = 3; // OR Fuse returns <3 hits
const SEMANTIC_DEBOUNCE_MS = 300;

export function GuideSearch({ index, slug }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const [semanticState, setSemanticState] = useState<SemanticState>({ kind: "idle" });
  const [showSemanticCta, setShowSemanticCta] = useState(false);
  const deferredQuery = useDeferredValue(query);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();
  const optionIdPrefix = useId();
  const abortRef = useRef<AbortController | null>(null);

  // Defer Fuse load until the dialog is first opened — the library is ~30 KB
  // minzipped and most page visits never open the search.
  const [fuse, setFuse] = useState<Fuse<GuideSearchEntry> | null>(null);
  useEffect(() => {
    if (!open || fuse) return;
    let cancelled = false;
    void import("fuse.js").then((mod) => {
      if (cancelled) return;
      setFuse(new mod.default(index.entries, FUSE_OPTIONS));
    });
    return () => {
      cancelled = true;
    };
  }, [open, fuse, index]);

  const results = useMemo<GuideSearchHit[]>(() => {
    if (!fuse) return [];
    const q = deferredQuery.trim();
    if (q.length < (FUSE_OPTIONS.minMatchCharLength ?? 1)) return [];
    return fuse
      .search(q, { limit: MAX_RESULTS })
      .map((r) => ({ entry: r.item, score: r.score ?? 1 }));
  }, [deferredQuery, fuse]);

  const minQueryLength = FUSE_OPTIONS.minMatchCharLength ?? 1;

  // Debounced miss-tracking. Fires once per "stable" zero-result query so
  // we don't report every keystroke of a typo in progress. Below the min
  // length Fuse can't even run — don't log those as misses. Also gate on
  // `fuse` being loaded: while the dynamic import is in flight, `results`
  // is `[]` because the memo short-circuits, which would otherwise log a
  // false-positive miss for every reopen of the dialog.
  useEffect(() => {
    if (!open || !fuse) return;
    const q = deferredQuery.trim();
    if (q.length < minQueryLength || results.length > 0) return;
    const handle = setTimeout(() => trackSearchMiss(q), MISS_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [open, fuse, deferredQuery, results.length, minQueryLength]);

  // `/` anywhere on the page opens search — but never when the user is
  // already typing in a form control, otherwise we'd steal focus from
  // unrelated inputs. Modifier keys are also excluded so browser binds
  // (Ctrl+/, Cmd+/) pass through.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== "/") return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (isEditableTarget(target)) return;
      e.preventDefault();
      setOpen((prev) => (prev ? prev : true));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    setActiveIdx(0);
  }, [deferredQuery]);

  // Debounce the CTA visibility: only show when the trigger condition holds
  // steadily for SEMANTIC_DEBOUNCE_MS. Otherwise the CTA would flash while
  // the user types. While `fuse` is null (dynamic import in flight) we don't
  // know `results.length` for real — `fuse === null` means *loading the local
  // index*, NOT zero local hits. Surfacing the CTA in that window would also
  // route Enter into the semantic endpoint for queries that have local matches
  // about to land. Hold the CTA off until the local index is ready.
  useEffect(() => {
    if (!fuse) {
      setShowSemanticCta(false);
      return;
    }
    const q = deferredQuery.trim();
    if (q.length < minQueryLength) {
      setShowSemanticCta(false);
      return;
    }
    const wordCount = q.split(/\s+/).filter(Boolean).length;
    const shouldShow =
      wordCount > SEMANTIC_WORDS_THRESHOLD ||
      results.length < SEMANTIC_FEW_HITS_THRESHOLD;
    if (!shouldShow) {
      setShowSemanticCta(false);
      return;
    }
    const handle = setTimeout(() => setShowSemanticCta(true), SEMANTIC_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [fuse, deferredQuery, results.length, minQueryLength]);

  // Reset state on close. The CTA visibility is derived, but the semantic
  // payload and any in-flight request must be cleared explicitly — otherwise
  // stale hits from a prior query can briefly flash when the user reopens.
  useEffect(() => {
    if (!open) {
      setQuery("");
      setActiveIdx(0);
      setSemanticState({ kind: "idle" });
      abortRef.current?.abort();
      abortRef.current = null;
    }
  }, [open]);

  // A new query invalidates the previous semantic payload. We always abort
  // the in-flight request so late responses can't overwrite a newer state.
  // Key on the immediate `query` (not `deferredQuery`): the CTA fetch itself
  // uses `query`, so if we kept the 300ms-lagged value here, a successful
  // response could land and then a late `deferredQuery` tick would reset the
  // state back to idle.
  useEffect(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setSemanticState({ kind: "idle" });
  }, [query]);

  const navigateTo = useCallback((anchor: string) => {
    const target = document.getElementById(anchor);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    // `replaceState` (not `pushState`) so repeated hits don't pollute
    // history with one entry per selection.
    window.history.replaceState(null, "", `#${anchor}`);
    setOpen(false);
  }, []);

  const runSemanticSearch = useCallback(async () => {
    // Use the immediate `query` state, not `deferredQuery` (300ms debounce):
    // when the user clicks the CTA right after typing, the debounced value
    // may still hold a stale string.
    const q = query.trim();
    if (q.length < minQueryLength) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setSemanticState({ kind: "loading" });
    try {
      const url = `/api/g/${encodeURIComponent(slug)}/search?q=${encodeURIComponent(q)}`;
      const res = await fetch(url, { signal: controller.signal });
      if (controller.signal.aborted) return;
      if (res.status === 429) {
        const body = await res.json().catch(() => ({ retryAfterSeconds: 60 }));
        setSemanticState({
          kind: "rate-limited",
          retryAfterSeconds: Number(body.retryAfterSeconds) || 60,
        });
        return;
      }
      if (!res.ok) {
        setSemanticState({ kind: "error" });
        return;
      }
      const payload = (await res.json()) as GuideSemanticSearchResponse;
      setSemanticState({
        kind: "ok",
        hits: payload.hits,
        degraded: payload.degraded,
      });
    } catch (err) {
      if ((err as { name?: string }).name === "AbortError") return;
      setSemanticState({ kind: "error" });
    }
  }, [query, minQueryLength, slug]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      if (results.length === 0) return;
      e.preventDefault();
      setActiveIdx((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      if (results.length === 0) return;
      e.preventDefault();
      setActiveIdx((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      if (results.length === 0) {
        // No Fuse match — but only fall through to semantic search if the
        // local index is actually loaded. While `fuse === null` the dynamic
        // import is still in flight; firing semantic for a query that would
        // have matched locally once the index resolves is the wrong answer.
        if (!fuse) return;
        if (showSemanticCta && semanticState.kind !== "loading") {
          e.preventDefault();
          void runSemanticSearch();
        }
        return;
      }
      e.preventDefault();
      const idx = Math.min(activeIdx, results.length - 1);
      navigateTo(results[idx].entry.anchor);
    }
  };

  const activeOptionId =
    results.length > 0
      ? `${optionIdPrefix}-opt-${Math.min(activeIdx, results.length - 1)}`
      : undefined;

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          className="guide-search__trigger"
          aria-label="Buscar en la guía"
          aria-keyshortcuts="/"
        >
          <SearchIcon />
          <span className="guide-search__trigger-label">Buscar</span>
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="guide-search__overlay" />
        <Dialog.Content
          className="guide-search__dialog"
          aria-label="Buscador de la guía"
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            inputRef.current?.focus();
          }}
        >
          <Dialog.Title className="guide-search__dialog-title">
            Buscar en la guía
          </Dialog.Title>
          <Dialog.Description className="guide-search__dialog-description">
            Escribe wifi, parking, llegada o salida para saltar al apartado.
          </Dialog.Description>
          <div
            className="guide-search__input-row"
            role="combobox"
            aria-expanded={results.length > 0}
            aria-haspopup="listbox"
            aria-controls={listboxId}
          >
            <SearchIcon aria-hidden="true" />
            <input
              ref={inputRef}
              type="search"
              className="guide-search__input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Buscar…"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              aria-autocomplete="list"
              aria-activedescendant={activeOptionId}
              aria-label="Buscar en la guía"
            />
          </div>
          <div className="guide-search__results-wrap">
            {deferredQuery.trim().length < minQueryLength ? null : !fuse ? (
              // Fuse import in flight — render nothing rather than a false
              // "no results" hint that flashes on the user's first keystroke.
              null
            ) : results.length === 0 ? (
              <p className="guide-search__empty" role="status">
                {ZERO_HINT}
              </p>
            ) : (
              <ul
                id={listboxId}
                role="listbox"
                aria-label="Resultados de búsqueda"
                className="guide-search__results"
              >
                {results.map((hit, i) => {
                  const selected = i === Math.min(activeIdx, results.length - 1);
                  return (
                    <li
                      key={hit.entry.id}
                      id={`${optionIdPrefix}-opt-${i}`}
                      role="option"
                      aria-selected={selected}
                      className={
                        selected
                          ? "guide-search__result guide-search__result--active"
                          : "guide-search__result"
                      }
                      onMouseEnter={() => setActiveIdx(i)}
                      onClick={() => navigateTo(hit.entry.anchor)}
                    >
                      <span className="guide-search__result-label">
                        {hit.entry.label}
                      </span>
                      {hit.entry.snippet && (
                        <span className="guide-search__result-snippet">
                          {hit.entry.snippet}
                        </span>
                      )}
                      <span className="guide-search__result-section">
                        en {hit.entry.sectionLabel}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
            {showSemanticCta && semanticState.kind !== "ok" && (
              <button
                type="button"
                className="guide-search__semantic-cta"
                onClick={() => void runSemanticSearch()}
                aria-disabled={semanticState.kind === "loading"}
                disabled={semanticState.kind === "loading"}
              >
                {semanticState.kind === "loading"
                  ? "Buscando…"
                  : "Búsqueda inteligente"}
              </button>
            )}
            {semanticState.kind === "ok" && (
              <>
                <p className="guide-search__divider">Resultados inteligentes</p>
                {semanticState.degraded && (
                  <p className="guide-search__inline-note" role="status">
                    Aún indexando — resultados parciales.
                  </p>
                )}
                {semanticState.hits.length === 0 ? (
                  <p className="guide-search__inline-note" role="status">
                    Sin coincidencias. Prueba a reformular la pregunta.
                  </p>
                ) : (
                  <ul
                    aria-label="Resultados inteligentes"
                    className="guide-search__results"
                  >
                    {semanticState.hits.map((hit) => (
                      <li key={hit.itemId}>
                        <button
                          type="button"
                          className="guide-search__result guide-search__result--semantic"
                          onClick={() => navigateTo(hit.anchor)}
                        >
                          <span className="guide-search__result-label">
                            {hit.label}
                          </span>
                          {hit.snippet && (
                            <span className="guide-search__result-snippet">
                              {hit.snippet}
                            </span>
                          )}
                          <span className="guide-search__result-section">
                            en {hit.sectionLabel}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
            {semanticState.kind === "error" && (
              <p className="guide-search__inline-error" role="alert">
                La búsqueda inteligente no está disponible ahora.
              </p>
            )}
            {semanticState.kind === "rate-limited" && (
              <p className="guide-search__inline-error" role="alert">
                Demasiadas búsquedas. Prueba en {semanticState.retryAfterSeconds}s.
              </p>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function isEditableTarget(el: HTMLElement | null): boolean {
  if (!el) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (el.isContentEditable) return true;
  return false;
}

function SearchIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx={11} cy={11} r={7} />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}
