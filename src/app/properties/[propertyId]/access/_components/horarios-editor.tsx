"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
} from "react";
import { LogIn, LogOut, X } from "lucide-react";
import { useIsDesktop } from "@/hooks/use-is-desktop";

// Source of truth for the 30-min picker grid (00:00..23:30). Exported so the
// parent form can drop its own copy and a single list governs both the wheel
// and any future surface that needs the same slot resolution.
export const TIME_OPTIONS_30MIN: readonly string[] = Array.from({ length: 48 }, (_, i) => {
  const h = String(Math.floor(i / 2)).padStart(2, "0");
  const m = i % 2 === 0 ? "00" : "30";
  return `${h}:${m}`;
});

export const FLEXIBLE_VALUE = "flexible";
const FLEXIBLE_LABEL = "Sin límite";

// HASTA list: "Sin límite" sits at the day boundary between 23:30 and 00:00.
// Combined with the infinite-wrap wheel below, the user spins seamlessly
// through ... 23:00 → 23:30 → Sin límite → 00:00 → 00:30 ... with no
// empty rows after the last item.
const CHECKIN_END_OPTIONS: readonly string[] = [...TIME_OPTIONS_30MIN, FLEXIBLE_VALUE];

const ITEM_HEIGHT = 36;
const VISIBLE_ROWS = 5;
const WHEEL_HEIGHT = ITEM_HEIGHT * VISIBLE_ROWS;
const WHEEL_PAD = ITEM_HEIGHT * Math.floor(VISIBLE_ROWS / 2);
// 3 identical copies. Render anchors in the middle copy; outer copies exist
// only so a vigorous swipe never hits the scroll boundary. After every snap
// we mirror scrollTop back into the middle copy — invisible because the
// content above/below is identical across copies.
const LOOP_COPIES = 3;

function displayOption(value: string) {
  return value === FLEXIBLE_VALUE ? FLEXIBLE_LABEL : value;
}

interface WheelPickerProps {
  options: readonly string[];
  value: string;
  onChange: (next: string) => void;
  ariaLabel: string;
  idPrefix: string;
}

function WheelPicker({ options, value, onChange, ariaLabel, idPrefix }: WheelPickerProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const valueRef = useRef(value);
  valueRef.current = value;
  // Tracks the last value we positioned scrollTop for. Without this guard the
  // useLayoutEffect below would yank the wheel back to the snapped row every
  // re-render triggered by our own onChange call.
  const lastSyncedValueRef = useRef<string | null>(null);

  const len = options.length;
  const safeIndex = Math.max(0, options.indexOf(value));
  const focusableIdx = len + safeIndex;
  const loopedOptions = Array.from({ length: len * LOOP_COPIES }, (_, i) => options[i % len]);

  useLayoutEffect(() => {
    if (lastSyncedValueRef.current === value) return;
    lastSyncedValueRef.current = value;
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = focusableIdx * ITEM_HEIGHT;
  }, [value, focusableIdx]);

  const handleScroll = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const el = scrollRef.current;
      if (!el) return;
      const idx = Math.round(el.scrollTop / ITEM_HEIGHT);
      const realIdx = ((idx % len) + len) % len;
      // Seamless wrap: after snap settles, mirror outer copies back to middle.
      // Visual content is identical across copies so the jump is imperceptible.
      if (idx < len || idx >= 2 * len) {
        const mirrored = (len + realIdx) * ITEM_HEIGHT;
        if (mirrored !== el.scrollTop) el.scrollTop = mirrored;
      }
      const next = options[realIdx];
      if (next !== valueRef.current) {
        lastSyncedValueRef.current = next;
        onChange(next);
      }
    }, 180);
  }, [onChange, options, len]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleRowClick = useCallback((idx: number) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: idx * ITEM_HEIGHT, behavior: "smooth" });
  }, []);

  // Roving tabindex (WAI-ARIA listbox). Only the active option owns tabIndex=0;
  // ArrowUp/Down/Home/End on the focused option scrolls + shifts focus to the
  // neighbor. Handler lives on the option <button> (not the scroll div) so the
  // interactive-elements static gate accepts it.
  const handleOptionKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLButtonElement>, i: number) => {
      const el = scrollRef.current;
      if (!el) return;
      const max = loopedOptions.length - 1;
      let nextIdx = i;
      switch (e.key) {
        case "ArrowDown":
          nextIdx = Math.min(max, i + 1);
          break;
        case "ArrowUp":
          nextIdx = Math.max(0, i - 1);
          break;
        case "Home":
          nextIdx = len;
          break;
        case "End":
          nextIdx = 2 * len - 1;
          break;
        default:
          return;
      }
      e.preventDefault();
      el.scrollTo({ top: nextIdx * ITEM_HEIGHT, behavior: "smooth" });
      const nextBtn = el.querySelector<HTMLButtonElement>(`#${idPrefix}-opt-${nextIdx}`);
      nextBtn?.focus({ preventScroll: true });
    },
    [idPrefix, len, loopedOptions.length],
  );

  return (
    <div
      className="relative w-full overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-background-subtle)]"
      style={{ height: WHEEL_HEIGHT }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 border-y border-[var(--color-action-primary)]/40 bg-[var(--color-action-primary)]/5"
        style={{ height: ITEM_HEIGHT }}
      />
      <div
        ref={scrollRef}
        role="listbox"
        aria-label={ariaLabel}
        aria-activedescendant={`${idPrefix}-opt-${focusableIdx}`}
        onScroll={handleScroll}
        className="h-full overflow-y-scroll outline-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{
          scrollSnapType: "y mandatory",
          paddingTop: WHEEL_PAD,
          paddingBottom: WHEEL_PAD,
          fontVariantNumeric: "tabular-nums",
          touchAction: "pan-y",
        }}
      >
        {loopedOptions.map((opt, i) => {
          const realIdx = i % len;
          const isActive = realIdx === safeIndex;
          const isFocusable = i === focusableIdx;
          return (
            <button
              type="button"
              key={`${i}-${opt}`}
              id={`${idPrefix}-opt-${i}`}
              role="option"
              aria-selected={isActive}
              tabIndex={isFocusable ? 0 : -1}
              onClick={() => handleRowClick(i)}
              onKeyDown={(e) => handleOptionKeyDown(e, i)}
              className="flex w-full items-center justify-center leading-none outline-none transition-[font-size,opacity,color] duration-150 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-action-primary)]"
              style={{
                height: ITEM_HEIGHT,
                scrollSnapAlign: "center",
                color: isActive ? "var(--color-text-primary)" : "var(--color-text-secondary)",
                opacity: isActive ? 1 : 0.45,
                fontSize: isActive ? 19 : 15,
                fontWeight: isActive ? 600 : 500,
              }}
            >
              {displayOption(opt)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

type EditingKind = "checkin" | "checkout";

interface TimeEditPanelProps {
  kind: EditingKind;
  isDesktop: boolean;
  wrapperRef: RefObject<HTMLDivElement | null>;
  checkInStart: string;
  checkInEnd: string;
  checkOutTime: string;
  onCheckInStartChange: (next: string) => void;
  onCheckInEndChange: (next: string) => void;
  onCheckOutTimeChange: (next: string) => void;
  onClose: () => void;
}

function TimeEditPanel({
  kind,
  isDesktop,
  wrapperRef,
  checkInStart,
  checkInEnd,
  checkOutTime,
  onCheckInStartChange,
  onCheckInEndChange,
  onCheckOutTimeChange,
  onClose,
}: TimeEditPanelProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Desktop only: clicking outside the wrapper (which contains both trigger
  // and popover) closes. Live-edit means closing equals committing — the
  // wheel has already pushed every snap to parent state.
  useEffect(() => {
    if (!isDesktop) return;
    const onDown = (e: MouseEvent) => {
      const wrapper = wrapperRef.current;
      if (!wrapper) return;
      const target = e.target;
      if (target instanceof Node && wrapper.contains(target)) return;
      onClose();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [isDesktop, onClose, wrapperRef]);

  const title = kind === "checkin" ? "Editar check-in" : "Editar check-out";

  const wheels =
    kind === "checkin" ? (
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-subtle)]">
            Desde
          </span>
          <WheelPicker
            options={TIME_OPTIONS_30MIN}
            value={checkInStart}
            onChange={onCheckInStartChange}
            ariaLabel="Hora de inicio del check-in"
            idPrefix="he-desde"
          />
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-subtle)]">
            Hasta
          </span>
          <WheelPicker
            options={CHECKIN_END_OPTIONS}
            value={checkInEnd || FLEXIBLE_VALUE}
            onChange={onCheckInEndChange}
            ariaLabel="Hora límite del check-in"
            idPrefix="he-hasta"
          />
        </div>
      </div>
    ) : (
      <div className="flex flex-col gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-subtle)]">
          Antes de
        </span>
        <WheelPicker
          options={TIME_OPTIONS_30MIN}
          value={checkOutTime}
          onChange={onCheckOutTimeChange}
          ariaLabel="Hora del check-out"
          idPrefix="he-checkout"
        />
      </div>
    );

  const header = (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h3 className="text-[12px] font-semibold uppercase tracking-[0.10em] text-[var(--color-text-muted)]">
        {title}
      </h3>
      <button
        type="button"
        onClick={onClose}
        aria-label="Cerrar"
        className="grid h-11 w-11 place-items-center rounded-[var(--radius-md)] text-[var(--color-text-muted)] hover:bg-[var(--color-background-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-primary)]"
      >
        <X aria-hidden="true" className="h-4 w-4" />
      </button>
    </div>
  );

  if (isDesktop) {
    // Content-aware width: check-in needs two wheels side-by-side, check-out
    // only one. Width drives the zoom-from-corner anchor proportions.
    const width = kind === "checkin" ? 360 : 240;
    return (
      <div
        role="dialog"
        aria-modal="false"
        aria-label={title}
        className="animate-horarios-zoom-in absolute z-30 rounded-[20px] border border-[var(--color-action-primary)] bg-[var(--color-background-elevated)] p-4"
        style={{
          top: 20,
          left: 20,
          width,
          boxShadow:
            "0 0 0 4px color-mix(in oklch, var(--color-action-primary) 18%, transparent), var(--elevation-popover)",
        }}
      >
        {header}
        {wheels}
      </div>
    );
  }

  return (
    <>
      <div
        className="animate-horarios-fade-in fixed inset-0 z-40 bg-[var(--color-background-scrim)]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="animate-horarios-slide-up fixed inset-x-0 bottom-0 z-50 rounded-t-[20px] bg-[var(--color-background-elevated)] p-4 pb-6"
        style={{ boxShadow: "var(--elevation-popover)" }}
      >
        <div
          className="mx-auto mb-3 h-1 w-10 rounded-full bg-[var(--color-border-strong)]"
          aria-hidden="true"
        />
        {header}
        {wheels}
      </div>
    </>
  );
}

interface HorarioRowProps {
  kind: EditingKind;
  tileValue: string;
  eyebrow: string;
  title: string;
  description: string;
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  isDesktop: boolean;
  checkInStart: string;
  checkInEnd: string;
  checkOutTime: string;
  onCheckInStartChange: (next: string) => void;
  onCheckInEndChange: (next: string) => void;
  onCheckOutTimeChange: (next: string) => void;
}

function HorarioRow({
  kind,
  tileValue,
  eyebrow,
  title,
  description,
  isOpen,
  onOpen,
  onClose,
  isDesktop,
  checkInStart,
  checkInEnd,
  checkOutTime,
  onCheckInStartChange,
  onCheckInEndChange,
  onCheckOutTimeChange,
}: HorarioRowProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [tileHour, tileMin] = tileValue.split(":");
  const dimContent = isOpen && isDesktop;
  const Icon = kind === "checkin" ? LogIn : LogOut;

  return (
    <div ref={wrapperRef} className="relative h-full">
      <button
        type="button"
        onClick={onOpen}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        className={`grid h-full min-h-[44px] w-full grid-cols-[auto_1fr] items-center gap-5 rounded-[16px] border bg-[var(--color-background-elevated)] p-5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-primary)] ${
          isOpen
            ? "border-[var(--color-action-primary)]"
            : "border-[var(--color-border-default)] hover:border-[var(--color-action-primary)]/40"
        }`}
      >
        <span
          aria-hidden="true"
          className="grid h-[80px] w-[80px] place-items-center rounded-[20px] text-[var(--color-text-on-accent)]"
          style={{
            background:
              "linear-gradient(135deg, var(--color-action-primary), color-mix(in oklch, var(--color-action-primary) 70%, var(--color-background-elevated)))",
            visibility: dimContent ? "hidden" : "visible",
          }}
        >
          <span className="flex flex-col items-center gap-2">
            <Icon className="h-3.5 w-3.5 opacity-70" />
            <span
              className="font-semibold leading-none tracking-[-0.02em]"
              style={{ fontSize: 30, fontVariantNumeric: "tabular-nums" }}
            >
              {tileHour}
              {tileMin && (
                <span className="ml-0.5 align-super text-[12px] font-medium opacity-70">
                  :{tileMin}
                </span>
              )}
            </span>
          </span>
        </span>
        <span
          className="block min-w-0 transition-opacity"
          style={{ opacity: dimContent ? 0.2 : 1 }}
        >
          <span className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
            {eyebrow}
          </span>
          <span className="mt-1 block text-[18px] font-semibold text-[var(--color-text-primary)]">
            {title}
          </span>
          <span className="mt-1 block max-w-[60ch] text-[13px] leading-[1.5] text-[var(--color-text-secondary)]">
            {description}
          </span>
        </span>
      </button>
      {isOpen && (
        <TimeEditPanel
          kind={kind}
          isDesktop={isDesktop}
          wrapperRef={wrapperRef}
          checkInStart={checkInStart}
          checkInEnd={checkInEnd}
          checkOutTime={checkOutTime}
          onCheckInStartChange={onCheckInStartChange}
          onCheckInEndChange={onCheckInEndChange}
          onCheckOutTimeChange={onCheckOutTimeChange}
          onClose={onClose}
        />
      )}
    </div>
  );
}

interface HorariosEditorProps {
  checkInStart: string;
  checkInEnd: string;
  checkOutTime: string;
  onCheckInStartChange: (next: string) => void;
  onCheckInEndChange: (next: string) => void;
  onCheckOutTimeChange: (next: string) => void;
  isAutonomousDerived: boolean;
  hasBuildingAccess: boolean;
}

export function HorariosEditor({
  checkInStart,
  checkInEnd,
  checkOutTime,
  onCheckInStartChange,
  onCheckInEndChange,
  onCheckOutTimeChange,
  isAutonomousDerived,
  hasBuildingAccess,
}: HorariosEditorProps) {
  const [editing, setEditing] = useState<EditingKind | null>(null);
  const isDesktop = useIsDesktop(768, true);

  const handleClose = useCallback(() => setEditing(null), []);

  const checkInRangeText = checkInStart
    ? `A partir de las ${checkInStart}${
        checkInEnd === FLEXIBLE_VALUE
          ? ", sin hora límite"
          : `, hasta las ${checkInEnd}`
      }`
    : "Define un horario para que el huésped sepa cuándo puede llegar.";

  const checkInDescription = isAutonomousDerived
    ? "Entrada autónoma — el huésped llega cuando quiera."
    : hasBuildingAccess
      ? "Acceso por edificio o recinto cerrado — coordina la llegada."
      : "Coordina la llegada — alguien recibirá al huésped.";

  return (
    <div className="horarios-container">
      <p className="mb-3 text-[12px] text-[var(--color-text-secondary)]">
        Pulsa una tarjeta para ajustar la llegada o salida.
      </p>
      <div className="horarios-grid">
        <HorarioRow
          kind="checkin"
          tileValue={checkInStart}
          eyebrow="Check-in"
          title={checkInRangeText}
          description={checkInDescription}
          isOpen={editing === "checkin"}
          onOpen={() => setEditing("checkin")}
          onClose={handleClose}
          isDesktop={isDesktop}
          checkInStart={checkInStart}
          checkInEnd={checkInEnd}
          checkOutTime={checkOutTime}
          onCheckInStartChange={onCheckInStartChange}
          onCheckInEndChange={onCheckInEndChange}
          onCheckOutTimeChange={onCheckOutTimeChange}
        />
        <HorarioRow
          kind="checkout"
          tileValue={checkOutTime}
          eyebrow="Check-out"
          title={`Antes de las ${checkOutTime}`}
          description="El huésped debe dejar la vivienda a esta hora. Late check-out por chat."
          isOpen={editing === "checkout"}
          onOpen={() => setEditing("checkout")}
          onClose={handleClose}
          isDesktop={isDesktop}
          checkInStart={checkInStart}
          checkInEnd={checkInEnd}
          checkOutTime={checkOutTime}
          onCheckInStartChange={onCheckInStartChange}
          onCheckInEndChange={onCheckInEndChange}
          onCheckOutTimeChange={onCheckOutTimeChange}
        />
      </div>
    </div>
  );
}
