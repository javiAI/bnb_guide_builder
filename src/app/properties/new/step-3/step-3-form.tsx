"use client";

import { useActionState, useState, useCallback } from "react";
import { Trash2 } from "lucide-react";
import { WizardShell } from "@/components/wizard/wizard-shell";
import { NumberStepper } from "@/components/ui/number-stepper";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { saveStep3Action } from "@/lib/actions/wizard.actions";
import type { ActionResult } from "@/lib/types/action-result";
import { bedTypes, getItems } from "@/lib/taxonomy-loader";
import type { StepFormProps } from "@/lib/types/wizard";

const bedTypeOptions = getItems(bedTypes).filter((item) => item.id !== "bt.crib").map((item) => ({
  id: item.id,
  label: item.label,
  capacity: (item as unknown as { sleepingCapacity: number }).sleepingCapacity ?? 1,
}));

interface BedEntry {
  location: string;
  bedType: string;
  quantity: number;
}

type Step3FormProps = StepFormProps;

export function Step3Form({ sessionId, initialState, maxStepReached, snapshot, snapshotStep }: Step3FormProps) {
  const initGuests = (initialState.maxGuests as number) ?? 2;
  const initAdults = (initialState.maxAdults as number) ?? initGuests;
  const initChildren = (initialState.maxChildren as number) ?? 0;

  const [maxGuests, setMaxGuests] = useState(initGuests);
  const [maxAdults, setMaxAdults] = useState(initAdults);
  const [maxChildren, setMaxChildren] = useState(initChildren);
  const [infantsAllowed, setInfantsAllowed] = useState((initialState.infantsAllowed as boolean) ?? false);
  const [bedroomsCount, setBedroomsCount] = useState((initialState.bedroomsCount as number) ?? 1);
  const [bathroomsCount, setBathroomsCount] = useState((initialState.bathroomsCount as number) ?? 1);

  // Initialize beds from state or default
  const [beds, setBeds] = useState<BedEntry[]>(() => {
    const stateBeds = initialState.beds as Array<{ spaceIndex: number; spaceType: string; bedType: string; quantity: number }> | undefined;
    if (stateBeds && stateBeds.length > 0) {
      return stateBeds.map((b) => {
        if (b.spaceType === "sp.bedroom") {
          return { location: `bedroom_${b.spaceIndex + 1}`, bedType: b.bedType, quantity: b.quantity };
        }
        const locMap: Record<string, string> = { "sp.living_room": "living_room", "sp.shared_area": "shared_area", "sp.other": "other" };
        return { location: locMap[b.spaceType] ?? "other", bedType: b.bedType, quantity: b.quantity };
      });
    }
    return [{ location: "bedroom_1", bedType: "bt.double", quantity: 1 }];
  });

  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    saveStep3Action,
    null,
  );

  // Adults + children must always equal maxGuests
  const handleMaxGuestsChange = useCallback((val: number) => {
    setMaxGuests(val);
    // Keep adults, adjust children
    const newAdults = Math.min(maxAdults, val);
    setMaxAdults(newAdults);
    setMaxChildren(val - newAdults);
  }, [maxAdults]);

  const handleMaxAdultsChange = useCallback((val: number) => {
    setMaxAdults(val);
    setMaxChildren(maxGuests - val);
  }, [maxGuests]);

  const handleMaxChildrenChange = useCallback((val: number) => {
    setMaxChildren(val);
    setMaxAdults(maxGuests - val);
  }, [maxGuests]);

  const handleBedroomsChange = useCallback((val: number) => {
    setBedroomsCount(val);
    setBeds((prev) => prev.filter((b) => {
      if (!b.location.startsWith("bedroom_")) return true;
      const idx = parseInt(b.location.split("_")[1]);
      return idx <= val;
    }));
  }, []);

  function locationOptions() {
    const opts: Array<{ value: string; label: string }> = [];
    for (let i = 1; i <= bedroomsCount; i++) {
      opts.push({ value: `bedroom_${i}`, label: `Dormitorio ${i}` });
    }
    opts.push({ value: "living_room", label: "Salón" });
    opts.push({ value: "shared_area", label: "Zona compartida" });
    opts.push({ value: "other", label: "Otra zona" });
    return opts;
  }

  function addBed() {
    const defaultLoc = bedroomsCount > 0 ? "bedroom_1" : "living_room";
    setBeds((prev) => [...prev, { location: defaultLoc, bedType: "bt.single", quantity: 1 }]);
  }

  function updateBed(idx: number, field: keyof BedEntry, value: string | number) {
    setBeds((prev) => prev.map((b, i) => i === idx ? { ...b, [field]: value } : b));
  }

  function removeBed(idx: number) {
    setBeds((prev) => prev.filter((_, i) => i !== idx));
  }

  const totalBedCapacity = beds.reduce((sum, b) => {
    const bt = bedTypeOptions.find((t) => t.id === b.bedType);
    return sum + (bt?.capacity ?? 1) * b.quantity;
  }, 0);

  const capacityWarning = totalBedCapacity < maxGuests;

  function bedsToStateFormat() {
    const locationMap: Record<string, string> = { living_room: "sp.living_room", shared_area: "sp.shared_area", other: "sp.other" };
    const otherLocations: string[] = [];
    return beds.map((b) => {
      if (b.location.startsWith("bedroom_")) {
        const idx = parseInt(b.location.split("_")[1]) - 1;
        return { spaceIndex: idx, spaceType: "sp.bedroom", bedType: b.bedType, quantity: b.quantity };
      }
      let otherIdx = otherLocations.indexOf(b.location);
      if (otherIdx === -1) { otherIdx = otherLocations.length; otherLocations.push(b.location); }
      return { spaceIndex: bedroomsCount + otherIdx, spaceType: locationMap[b.location] ?? "sp.other", bedType: b.bedType, quantity: b.quantity };
    });
  }

  const locs = locationOptions();

  return (
    <WizardShell
      currentStep={3}
      totalSteps={4}
      title="Capacidad y estructura"
      subtitle="Define cuántas personas pueden alojarse y la distribución de camas."
      backHref={`/properties/new/step-2?sessionId=${sessionId}`}
      sessionId={sessionId}
      maxStepReached={maxStepReached}
      snapshot={snapshot}
      snapshotStep={snapshotStep}
    >
      <form action={formAction} data-wizard-form className="space-y-8">
        <input type="hidden" name="sessionId" value={sessionId} />
        <input type="hidden" name="beds" value={JSON.stringify(bedsToStateFormat())} />

        {/* Guests */}
        <div>
          <h2 className="mb-4 text-sm font-semibold text-[var(--foreground)]">
            Huéspedes
            <InfoTooltip text="Define el máximo total de huéspedes. Siempre debe haber al menos 1 adulto. Los adultos adicionales representan plazas flexibles: cada una puede ser ocupada por un adulto o un niño. Si seleccionas niños, esas plazas solo pueden ser ocupadas por menores de 14 años." />
          </h2>
          <NumberStepper label="Máximo de huéspedes" name="maxGuests" value={maxGuests} onChange={handleMaxGuestsChange} min={1} max={30} />

          <div className="ml-4 mt-3 space-y-2 border-l-2 border-[var(--color-neutral-200)] pl-4">
            <NumberStepper label="Número máximo de adultos" name="maxAdults" value={maxAdults} onChange={handleMaxAdultsChange} min={1} max={maxGuests} />
            <NumberStepper label="Niños (menores de 14 años)" name="maxChildren" value={maxChildren} onChange={handleMaxChildrenChange} min={0} max={maxGuests - 1} />
          </div>

          <label className="mt-4 flex items-center gap-2 cursor-pointer">
            <input type="checkbox" name="infantsAllowed" checked={infantsAllowed} onChange={(e) => setInfantsAllowed(e.target.checked)} className="h-4 w-4 accent-[var(--color-primary-500)]" />
            <span className="text-sm text-[var(--foreground)]">Se admiten bebés (cuna disponible)</span>
            <InfoTooltip text="Los bebés menores de 2 años no cuentan como huéspedes. Activar esta opción indica que dispones de cuna." />
          </label>

          {state?.fieldErrors?.maxAdults && <p className="mt-2 text-sm text-[var(--color-danger-500)]">{state.fieldErrors.maxAdults[0]}</p>}
          {state?.fieldErrors?.maxChildren && <p className="mt-2 text-sm text-[var(--color-danger-500)]">{state.fieldErrors.maxChildren[0]}</p>}
        </div>

        {/* Structure */}
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <h2 className="mb-4 text-sm font-semibold text-[var(--foreground)]">Dormitorios</h2>
            <NumberStepper label="Dormitorios" name="bedroomsCount" value={bedroomsCount} onChange={handleBedroomsChange} min={0} max={20} />
          </div>
          <div>
            <h2 className="mb-4 text-sm font-semibold text-[var(--foreground)]">Baños</h2>
            <NumberStepper label="Baños" name="bathroomsCount" value={bathroomsCount} onChange={setBathroomsCount} min={1} max={15} />
          </div>
        </div>

        {/* Beds */}
        <div>
          <h2 className="mb-2 text-sm font-semibold text-[var(--foreground)]">
            Camas
            <InfoTooltip text="La capacidad total de camas puede ser mayor que el máximo de huéspedes. Esto es normal: indica que hay espacio de sobra, no que se admitan más personas de las indicadas." />
          </h2>
          <p className="mb-4 text-xs text-[var(--color-neutral-500)]">Añade cada cama indicando dónde se encuentra y de qué tipo es.</p>

          <div className="space-y-2">
            <div className="hidden sm:grid sm:grid-cols-[1fr_1fr_64px_44px] gap-2 text-xs font-medium text-[var(--color-neutral-500)] px-1">
              <span>Ubicación</span><span>Tipo de cama</span><span>Cant.</span><span />
            </div>
            {beds.map((bed, idx) => (
              <div key={idx} className="grid grid-cols-[1fr_1fr_64px_44px] items-center gap-2">
                <select value={bed.location} onChange={(e) => updateBed(idx, "location", e.target.value)} className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-2 py-1.5 text-sm">
                  {locs.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
                <select value={bed.bedType} onChange={(e) => updateBed(idx, "bedType", e.target.value)} className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-2 py-1.5 text-sm">
                  {bedTypeOptions.map((bt) => <option key={bt.id} value={bt.id}>{bt.label}</option>)}
                </select>
                <select value={bed.quantity} onChange={(e) => updateBed(idx, "quantity", Number(e.target.value))} className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-2 py-1.5 text-sm">
                  {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
                {beds.length > 1 ? <button type="button" onClick={() => removeBed(idx)} className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-[var(--radius-md)] text-[var(--color-neutral-400)] hover:text-[var(--color-status-error-text)] hover:bg-[var(--color-status-error-bg)] transition-colors" aria-label={`Eliminar cama ${idx + 1}`}><Trash2 size={20} className="w-5 h-5" /></button> : <span />}
              </div>
            ))}
          </div>

          <button type="button" onClick={addBed} className="mt-3 inline-flex min-h-[44px] items-center gap-1 rounded-[var(--radius-md)] border border-dashed border-[var(--color-neutral-300)] px-3 py-2 text-xs font-medium text-[var(--color-neutral-600)] hover:border-[var(--color-primary-400)] hover:text-[var(--color-primary-500)]">
            + Añadir cama
          </button>

          <div className="mt-3 flex items-center gap-2 text-xs">
            <span className="text-[var(--color-neutral-500)]">Capacidad total: {totalBedCapacity} personas</span>
            {capacityWarning && <span className="rounded bg-[var(--color-status-warning-bg)] px-1.5 py-0.5 text-[var(--color-status-warning-text)]">Inferior al máximo de huéspedes ({maxGuests})</span>}
          </div>
        </div>

        <button type="submit" disabled={pending || totalBedCapacity < maxGuests} className="mt-4 inline-flex min-h-[44px] w-full items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary-500)] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--color-primary-600)] disabled:opacity-50">
          {pending ? "Guardando…" : "Continuar"}
        </button>
      </form>
    </WizardShell>
  );
}
