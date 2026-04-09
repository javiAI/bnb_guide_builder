/**
 * Wizard step schema definitions.
 *
 * Each step is declaratively defined: fields, taxonomy sources, defaults,
 * validation rules, and layout hints. The wizard renderer consumes these
 * definitions — adding a new field or step requires editing only this file
 * and the corresponding Zod schema + Prisma model, not the React components.
 */

import type { ItemTaxonomyFile } from "@/lib/types/taxonomy";
import {
  propertyTypes,
  roomTypes,
  accessMethods,
} from "@/lib/taxonomy-loader";

// ── Field type discriminator ──

export type FieldType =
  | "taxonomy_radio"     // RadioCardGroup driven by a taxonomy
  | "taxonomy_select"    // <select> driven by a taxonomy
  | "text"               // Free text input
  | "number_stepper"     // NumberStepper with min/max
  | "time_select"        // Time dropdown (HH:MM, 30-min intervals)
  | "select"             // Static <select> with options
  | "textarea"           // Multi-line text
  | "tel"                // Phone input
  | "checkbox"           // Boolean checkbox
  | "taxonomy_chips";    // Multi-select chips driven by a taxonomy

export interface FieldOption {
  value: string;
  label: string;
}

// ── Base field definition ──

export interface BaseFieldDef {
  name: string;
  label: string;
  type: FieldType;
  required: boolean;
  placeholder?: string;
  helpText?: string;
  defaultValue?: string | number | boolean;
  /** CSS grid column span (1 or 2 out of 2-col grid) */
  colSpan?: 1 | 2;
}

export interface TaxonomyRadioFieldDef extends BaseFieldDef {
  type: "taxonomy_radio";
  taxonomy: ItemTaxonomyFile;
}

export interface TaxonomySelectFieldDef extends BaseFieldDef {
  type: "taxonomy_select";
  taxonomy: ItemTaxonomyFile;
}

export interface TaxonomyChipsFieldDef extends BaseFieldDef {
  type: "taxonomy_chips";
  taxonomy: ItemTaxonomyFile;
}

export interface TextFieldDef extends BaseFieldDef {
  type: "text";
}

export interface TelFieldDef extends BaseFieldDef {
  type: "tel";
}

export interface TextareaFieldDef extends BaseFieldDef {
  type: "textarea";
  rows?: number;
}

export interface NumberStepperFieldDef extends BaseFieldDef {
  type: "number_stepper";
  min: number;
  max: number;
  defaultValue: number;
}

export interface TimeSelectFieldDef extends BaseFieldDef {
  type: "time_select";
  defaultValue: string;
}

export interface SelectFieldDef extends BaseFieldDef {
  type: "select";
  options: FieldOption[];
}

export interface CheckboxFieldDef extends BaseFieldDef {
  type: "checkbox";
}

export type FieldDef =
  | TaxonomyRadioFieldDef
  | TaxonomySelectFieldDef
  | TaxonomyChipsFieldDef
  | TextFieldDef
  | TelFieldDef
  | TextareaFieldDef
  | NumberStepperFieldDef
  | TimeSelectFieldDef
  | SelectFieldDef
  | CheckboxFieldDef;

// ── Field group (visual section within a step) ──

export interface FieldGroup {
  id: string;
  label: string;
  description?: string;
  fields: FieldDef[];
  /** Layout mode: 'stack' (default) or 'grid' (2-col) */
  layout?: "stack" | "grid";
}

// ── Wizard step definition ──

export interface WizardStepDef {
  step: number;
  title: string;
  subtitle: string;
  groups: FieldGroup[];
  submitLabel: string;
  pendingLabel: string;
}

// ── Common timezone options ──

const TIMEZONE_OPTIONS: FieldOption[] = [
  { value: "Europe/Madrid", label: "Europa/Madrid (CET)" },
  { value: "Europe/London", label: "Europa/Londres (GMT)" },
  { value: "Europe/Paris", label: "Europa/París (CET)" },
  { value: "Europe/Berlin", label: "Europa/Berlín (CET)" },
  { value: "Europe/Rome", label: "Europa/Roma (CET)" },
  { value: "Europe/Lisbon", label: "Europa/Lisboa (WET)" },
  { value: "America/New_York", label: "América/Nueva York (EST)" },
  { value: "America/Chicago", label: "América/Chicago (CST)" },
  { value: "America/Denver", label: "América/Denver (MST)" },
  { value: "America/Los_Angeles", label: "América/Los Ángeles (PST)" },
  { value: "America/Mexico_City", label: "América/Ciudad de México (CST)" },
  { value: "America/Bogota", label: "América/Bogotá (COT)" },
  { value: "America/Buenos_Aires", label: "América/Buenos Aires (ART)" },
  { value: "America/Sao_Paulo", label: "América/São Paulo (BRT)" },
  { value: "Asia/Tokyo", label: "Asia/Tokio (JST)" },
  { value: "Asia/Dubai", label: "Asia/Dubái (GST)" },
  { value: "Australia/Sydney", label: "Australia/Sídney (AEST)" },
];

// ── Step definitions ──

export const WIZARD_STEPS: WizardStepDef[] = [
  {
    step: 1,
    title: "Tipo de alojamiento",
    subtitle:
      "Selecciona qué tipo de propiedad ofreces y cómo la utilizarán los huéspedes.",
    submitLabel: "Continuar",
    pendingLabel: "Guardando…",
    groups: [
      {
        id: "property_type",
        label: "Tipo de propiedad",
        fields: [
          {
            name: "propertyType",
            label: "Tipo de propiedad",
            type: "taxonomy_radio",
            taxonomy: propertyTypes,
            required: true,
          },
        ],
      },
      {
        id: "room_type",
        label: "Tipo de espacio",
        fields: [
          {
            name: "roomType",
            label: "Tipo de espacio",
            type: "taxonomy_radio",
            taxonomy: roomTypes,
            required: true,
          },
        ],
      },
    ],
  },
  {
    step: 2,
    title: "Ubicación",
    subtitle:
      "Indica dónde se encuentra tu propiedad para generar contenido localizado.",
    submitLabel: "Continuar",
    pendingLabel: "Guardando…",
    groups: [
      {
        id: "location_required",
        label: "Ubicación principal",
        layout: "grid",
        fields: [
          {
            name: "country",
            label: "País *",
            type: "text",
            required: true,
            placeholder: "España",
          },
          {
            name: "city",
            label: "Ciudad *",
            type: "text",
            required: true,
            placeholder: "Valencia",
          },
          {
            name: "region",
            label: "Región / Provincia",
            type: "text",
            required: false,
            placeholder: "Comunidad Valenciana",
          },
          {
            name: "postalCode",
            label: "Código postal",
            type: "text",
            required: false,
            placeholder: "46001",
          },
        ],
      },
      {
        id: "location_detail",
        label: "Dirección completa",
        layout: "grid",
        fields: [
          {
            name: "streetAddress",
            label: "Dirección",
            type: "text",
            required: false,
            placeholder: "Calle Mayor 12, 3A",
            colSpan: 2,
          },
          {
            name: "addressLevel",
            label: "Piso / Planta",
            type: "text",
            required: false,
            placeholder: "3A",
          },
        ],
      },
      {
        id: "timezone",
        label: "Zona horaria",
        fields: [
          {
            name: "timezone",
            label: "Zona horaria *",
            type: "select",
            required: true,
            options: TIMEZONE_OPTIONS,
            defaultValue: "Europe/Madrid",
          },
        ],
      },
    ],
  },
  {
    step: 3,
    title: "Capacidad",
    subtitle:
      "Indica la capacidad de tu alojamiento para dimensionar la guía y validar reservas.",
    submitLabel: "Continuar",
    pendingLabel: "Guardando…",
    groups: [
      {
        id: "capacity",
        label: "Capacidad del alojamiento",
        layout: "grid",
        fields: [
          {
            name: "maxGuests",
            label: "Huéspedes máximos",
            type: "number_stepper",
            required: true,
            min: 1,
            max: 50,
            defaultValue: 2,
          },
          {
            name: "bedroomsCount",
            label: "Dormitorios",
            type: "number_stepper",
            required: false,
            min: 0,
            max: 30,
            defaultValue: 1,
          },
          {
            name: "bedsCount",
            label: "Camas",
            type: "number_stepper",
            required: true,
            min: 1,
            max: 50,
            defaultValue: 1,
          },
          {
            name: "bathroomsCount",
            label: "Baños",
            type: "number_stepper",
            required: true,
            min: 1,
            max: 20,
            defaultValue: 1,
          },
        ],
      },
    ],
  },
  {
    step: 4,
    title: "Llegada básica",
    subtitle:
      "Horarios de check-in, check-out y cómo acceden los huéspedes.",
    submitLabel: "Continuar a revisión",
    pendingLabel: "Guardando…",
    groups: [
      {
        id: "checkin_window",
        label: "Ventana de check-in",
        layout: "grid",
        fields: [
          {
            name: "checkInStart",
            label: "Desde *",
            type: "time_select",
            required: true,
            defaultValue: "16:00",
          },
          {
            name: "checkInEnd",
            label: "Hasta *",
            type: "time_select",
            required: true,
            defaultValue: "22:00",
          },
        ],
      },
      {
        id: "checkout",
        label: "Check-out",
        fields: [
          {
            name: "checkOutTime",
            label: "Hora de check-out *",
            type: "time_select",
            required: true,
            defaultValue: "11:00",
          },
        ],
      },
      {
        id: "access_method",
        label: "Método de acceso principal",
        fields: [
          {
            name: "primaryAccessMethod",
            label: "Método de acceso",
            type: "taxonomy_radio",
            taxonomy: accessMethods,
            required: true,
          },
        ],
      },
      {
        id: "contact",
        label: "Contacto",
        description: "Opcional — se usará para soporte al huésped",
        layout: "grid",
        fields: [
          {
            name: "hostContactPhone",
            label: "Teléfono de contacto",
            type: "tel",
            required: false,
            placeholder: "+34...",
          },
          {
            name: "supportContact",
            label: "Contacto de soporte",
            type: "text",
            required: false,
            placeholder: "Nombre o equipo",
          },
        ],
      },
    ],
  },
];

export function getWizardStep(step: number): WizardStepDef | undefined {
  return WIZARD_STEPS.find((s) => s.step === step);
}
