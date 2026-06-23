"use client";

import {
  useActionState,
  useEffect,
  useState,
  useTransition,
  type FormEvent,
} from "react";
import { Loader2 } from "lucide-react";
import { createLocalPlaceAction } from "@/lib/actions/editor.actions";
import type { ActionResult } from "@/lib/types/action-result";
import type { PoiSuggestion } from "@/lib/services/places";
import { PlaceAutocomplete } from "@/components/local-guide/place-autocomplete";
import { ToggleChip } from "@/components/ui/toggle-chip";
import { FieldInput } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import type { LocalPlaceCategoryOption } from "./local-place-card";

interface CreateLocalPlaceFormProps {
  propertyId: string;
  categories: ReadonlyArray<LocalPlaceCategoryOption>;
}

/**
 * Paso 02 — UN solo control primario (charter 16I): the autocomplete creates
 * the place at once on suggestion select (one-click, no preview/confirm — a
 * wrong add is a 2-click delete and duplicates get a friendly unique-index
 * message). Notes/distance live on the card's editor, never here. The manual
 * fallback (place not findable) is an indented reveal with category chips +
 * name and an explicit "Añadir lugar" button.
 */
export function CreateLocalPlaceForm({
  propertyId,
  categories,
}: CreateLocalPlaceFormProps) {
  const [state, dispatch, pending] = useActionState<ActionResult | null, FormData>(
    createLocalPlaceAction,
    null,
  );
  const [, startTransition] = useTransition();
  const [manual, setManual] = useState(false);
  const [manualCategory, setManualCategory] = useState<string | null>(null);
  const [manualName, setManualName] = useState("");

  // After a successful create, close + clear the manual reveal so the next
  // alta starts again from the single search control.
  useEffect(() => {
    if (state?.success) {
      setManual(false);
      setManualCategory(null);
      setManualName("");
    }
  }, [state]);

  function createFrom(fields: Record<string, string>) {
    const fd = new FormData();
    fd.append("propertyId", propertyId);
    for (const [key, value] of Object.entries(fields)) fd.append(key, value);
    startTransition(() => dispatch(fd));
  }

  // One-click create: the PoiSuggestion's categoryKey is always a registered
  // lp.* key (guaranteed by PoiSuggestionSchema), so no confirm step is needed.
  function handleSelect(s: PoiSuggestion) {
    createFrom({
      categoryKey: s.categoryKey,
      name: s.name,
      latitude: String(s.latitude),
      longitude: String(s.longitude),
      ...(s.address ? { address: s.address } : {}),
      ...(s.website ? { website: s.website } : {}),
      ...(typeof s.distanceMeters === "number"
        ? { distanceMeters: String(s.distanceMeters) }
        : {}),
      provider: s.provider,
      providerPlaceId: s.providerPlaceId,
      providerMetadata: JSON.stringify(s.providerMetadata),
    });
  }

  function submitManual(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const name = manualName.trim();
    if (!manualCategory || !name) return;
    createFrom({ categoryKey: manualCategory, name });
  }

  const error =
    state && !state.success
      ? (state.error ??
        Object.values(state.fieldErrors ?? {}).flat()[0] ??
        null)
      : null;

  return (
    <div className="space-y-3">
      <div className="max-w-xl">
        {pending ? (
          <p
            role="status"
            className="flex min-h-[44px] items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-background-muted)] px-3 text-sm text-[var(--color-text-secondary)]"
          >
            <Loader2 size={14} aria-hidden="true" className="animate-spin" />
            Añadiendo…
          </p>
        ) : (
          <PlaceAutocomplete
            propertyId={propertyId}
            onSelect={handleSelect}
            onManualFallback={() => setManual(true)}
          />
        )}
      </div>
      <p className="text-xs text-[var(--color-text-muted)]">
        Selecciona una sugerencia y se añade al momento — la nota y los detalles
        se completan en su tarjeta.
      </p>

      {error && (
        <p className="text-xs text-[var(--color-status-error-text)]">{error}</p>
      )}

      {!manual ? (
        <p className="text-xs text-[var(--color-text-muted)]">
          ¿No aparece en la búsqueda?{" "}
          <button
            type="button"
            onClick={() => setManual(true)}
            className="font-medium text-[var(--color-text-link)] hover:underline"
          >
            Añadirlo manualmente
          </button>
        </p>
      ) : (
        <form
          onSubmit={submitManual}
          className="space-y-4 border-l-2 border-[var(--color-border-default)] pl-4"
        >
          <div>
            <p className="mb-1.5 text-xs font-semibold text-[var(--color-text-primary)]">
              Categoría
              <span className="ml-0.5 text-[var(--color-text-muted)]">*</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => (
                <ToggleChip
                  key={c.id}
                  active={manualCategory === c.id}
                  hideCheck
                  onToggle={() => setManualCategory(c.id)}
                >
                  {c.label}
                </ToggleChip>
              ))}
            </div>
          </div>

          <div className="max-w-sm">
            {/* `required` visual (asterisk) only — submit is gated by the
               disabled button, never by native validation popups. */}
            <FieldInput
              label="Nombre"
              required
              name="name"
              type="text"
              value={manualName}
              onChange={(e) => setManualName(e.target.value)}
              placeholder="Ej: Bar El Rincón"
            />
          </div>

          <div className="flex items-center gap-3">
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={pending || !manualCategory || !manualName.trim()}
            >
              {pending ? "Añadiendo…" : "Añadir lugar"}
            </Button>
            <button
              type="button"
              onClick={() => {
                setManual(false);
                setManualCategory(null);
                setManualName("");
              }}
              className="min-h-[44px] px-2 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
