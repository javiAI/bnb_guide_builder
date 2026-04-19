"use client";

import * as Dialog from "@radix-ui/react-dialog";
import Fuse from "fuse.js";
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  createFuseFromIndex,
  FUSE_OPTIONS,
} from "@/lib/client/guide-search-index";
import { trackSearchMiss } from "@/lib/client/guide-analytics";
import type {
  GuideSearchEntry,
  GuideSearchHit,
  GuideSearchIndex,
} from "@/lib/types/guide-search-hit";

interface Props {
  index: GuideSearchIndex;
}

const MAX_RESULTS = 8;
const ZERO_HINT =
  "Nada coincide. Prueba «wifi», «parking», «checkout», «llegada», «normas».";
const MISS_DEBOUNCE_MS = 600;

export function GuideSearch({ index }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const deferredQuery = useDeferredValue(query);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();
  const optionIdPrefix = useId();

  const fuse = useMemo<Fuse<GuideSearchEntry>>(
    () => createFuseFromIndex(index),
    [index],
  );

  const results = useMemo<GuideSearchHit[]>(() => {
    const q = deferredQuery.trim();
    if (q.length < (FUSE_OPTIONS.minMatchCharLength ?? 1)) return [];
    return fuse
      .search(q, { limit: MAX_RESULTS })
      .map((r) => ({ entry: r.item, score: r.score ?? 1 }));
  }, [deferredQuery, fuse]);

  const minQueryLength = FUSE_OPTIONS.minMatchCharLength ?? 1;

  // Debounced miss-tracking. Fires once per "stable" zero-result query so
  // we don't report every keystroke of a typo in progress. Below the min
  // length Fuse can't even run — don't log those as misses.
  useEffect(() => {
    if (!open) return;
    const q = deferredQuery.trim();
    if (q.length < minQueryLength || results.length > 0) return;
    const handle = setTimeout(() => trackSearchMiss(q), MISS_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [open, deferredQuery, results.length, minQueryLength]);

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

  // When the dialog closes, reset state so the next open starts fresh.
  useEffect(() => {
    if (!open) {
      setQuery("");
      setActiveIdx(0);
    }
  }, [open]);

  const navigateTo = useCallback(
    (entry: GuideSearchEntry) => {
      const target = document.getElementById(entry.anchor);
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      // `replaceState` (not `pushState`) so repeated hits don't pollute
      // history with one entry per selection.
      window.history.replaceState(null, "", `#${entry.anchor}`);
      setOpen(false);
    },
    [],
  );

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
      if (results.length === 0) return;
      e.preventDefault();
      const idx = Math.min(activeIdx, results.length - 1);
      navigateTo(results[idx].entry);
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
            {query.trim().length < minQueryLength ? null : results.length === 0 ? (
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
                      onClick={() => navigateTo(hit.entry)}
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
