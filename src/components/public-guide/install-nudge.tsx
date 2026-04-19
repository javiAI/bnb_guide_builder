"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Trigger logic is load-bearing across Liora replatform (FASE 15) — the
 * skin can change but the visit/time thresholds and per-slug dismissal
 * persistence cannot, so they are encoded as exported constants. */
export const NUDGE_STORAGE_PREFIX = "guide-install-nudge:";
const VISIT_THRESHOLD = 2;
const TIME_THRESHOLD_MS = 90_000;

interface NudgeState {
  visits: number;
  cumulativeMs: number;
  dismissedAt: number | null;
  installedAt: number | null;
}

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function readState(slug: string): NudgeState {
  if (typeof window === "undefined") {
    return { visits: 0, cumulativeMs: 0, dismissedAt: null, installedAt: null };
  }
  try {
    const raw = window.localStorage.getItem(NUDGE_STORAGE_PREFIX + slug);
    if (!raw) {
      return { visits: 0, cumulativeMs: 0, dismissedAt: null, installedAt: null };
    }
    const parsed = JSON.parse(raw) as Partial<NudgeState>;
    return {
      visits: parsed.visits ?? 0,
      cumulativeMs: parsed.cumulativeMs ?? 0,
      dismissedAt: parsed.dismissedAt ?? null,
      installedAt: parsed.installedAt ?? null,
    };
  } catch {
    return { visits: 0, cumulativeMs: 0, dismissedAt: null, installedAt: null };
  }
}

function writeState(slug: string, state: NudgeState): void {
  try {
    window.localStorage.setItem(NUDGE_STORAGE_PREFIX + slug, JSON.stringify(state));
  } catch {
    /* quota / disabled — silently no-op */
  }
}

function isIosSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const isIosDevice = /iPad|iPhone|iPod/.test(ua);
  // iPadOS 13+ in "desktop-class browsing" reports Macintosh UA but has touch.
  const isIpadOsDesktop = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  // Chrome on iOS reports "CriOS"; Edge on iOS reports "EdgiOS"; we want
  // only Mobile Safari (which lacks `beforeinstallprompt`).
  const isStandaloneSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
  return (isIosDevice || isIpadOsDesktop) && isStandaloneSafari;
}

function isStandaloneInstalled(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
  // iOS exposes `navigator.standalone` (non-standard) on installed PWAs.
  const ios = (window.navigator as Navigator & { standalone?: boolean }).standalone;
  return Boolean(ios);
}

export function InstallNudge({ slug }: { slug: string }) {
  const [visible, setVisible] = useState(false);
  const [iosInstructionsOpen, setIosInstructionsOpen] = useState(false);
  const promptEventRef = useRef<BeforeInstallPromptEvent | null>(null);
  const sessionStartRef = useRef<number>(Date.now());

  const persistDismiss = useCallback(() => {
    const state = readState(slug);
    writeState(slug, { ...state, dismissedAt: Date.now() });
  }, [slug]);

  const handleDismiss = useCallback(() => {
    setVisible(false);
    setIosInstructionsOpen(false);
    persistDismiss();
  }, [persistDismiss]);

  const handleInstallClick = useCallback(async () => {
    const ev = promptEventRef.current;
    if (ev) {
      try {
        await ev.prompt();
        const choice = await ev.userChoice;
        const state = readState(slug);
        if (choice.outcome === "accepted") {
          writeState(slug, { ...state, installedAt: Date.now() });
        } else {
          writeState(slug, { ...state, dismissedAt: Date.now() });
        }
      } catch {
        persistDismiss();
      }
      setVisible(false);
      promptEventRef.current = null;
      return;
    }
    // No native prompt: show A2HS instructions only on iOS/iPadOS Safari;
    // other browsers without beforeinstallprompt can't install — dismiss.
    if (isIosSafari()) {
      setIosInstructionsOpen(true);
    } else {
      handleDismiss();
    }
  }, [slug, persistDismiss, handleDismiss]);

  // Mount: bump visit count, evaluate threshold, accumulate time.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandaloneInstalled()) return;

    const initial = readState(slug);
    if (initial.dismissedAt || initial.installedAt) return;

    const nextVisits = initial.visits + 1;
    const next: NudgeState = { ...initial, visits: nextVisits };
    writeState(slug, next);

    let shown = false;
    let tick: number | undefined;
    const evaluate = () => {
      const elapsed = Date.now() - sessionStartRef.current;
      const total = readState(slug).cumulativeMs + elapsed;
      if (nextVisits >= VISIT_THRESHOLD || total >= TIME_THRESHOLD_MS) {
        const fresh = readState(slug);
        if (!fresh.dismissedAt && !fresh.installedAt) {
          setVisible(true);
          shown = true;
          if (tick !== undefined) {
            window.clearInterval(tick);
            tick = undefined;
          }
        }
      }
    };
    evaluate();
    if (!shown) tick = window.setInterval(evaluate, 5_000);

    const flushTime = () => {
      const elapsed = Date.now() - sessionStartRef.current;
      const fresh = readState(slug);
      writeState(slug, { ...fresh, cumulativeMs: fresh.cumulativeMs + elapsed });
      sessionStartRef.current = Date.now();
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flushTime();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flushTime);

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      promptEventRef.current = event as BeforeInstallPromptEvent;
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);

    const onInstalled = () => {
      const fresh = readState(slug);
      writeState(slug, { ...fresh, installedAt: Date.now() });
      setVisible(false);
    };
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      if (tick !== undefined) window.clearInterval(tick);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flushTime);
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
      flushTime();
    };
  }, [slug]);

  if (!visible) return null;

  const ios = isIosSafari();

  return (
    <div className="guide-install-nudge" role="dialog" aria-labelledby="guide-install-nudge-title">
      {iosInstructionsOpen ? (
        <div className="guide-install-nudge__panel">
          <h2 id="guide-install-nudge-title" className="guide-install-nudge__title">
            Añadir a pantalla de inicio
          </h2>
          <ol className="guide-install-nudge__steps">
            <li>Pulsa el botón Compartir en la barra inferior.</li>
            <li>Elige &quot;Añadir a pantalla de inicio&quot;.</li>
            <li>Confirma para guardar la guía.</li>
          </ol>
          <div className="guide-install-nudge__actions">
            <button type="button" onClick={handleDismiss} className="guide-install-nudge__btn-secondary">
              Cerrar
            </button>
          </div>
        </div>
      ) : (
        <div className="guide-install-nudge__panel">
          <p id="guide-install-nudge-title" className="guide-install-nudge__title">
            Guarda esta guía
          </p>
          <p className="guide-install-nudge__body">
            Tenla a mano sin conexión durante tu estancia.
          </p>
          <div className="guide-install-nudge__actions">
            <button
              type="button"
              onClick={handleInstallClick}
              className="guide-install-nudge__btn-primary"
            >
              {ios ? "Cómo añadir" : "Instalar"}
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              className="guide-install-nudge__btn-secondary"
            >
              Ahora no
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
