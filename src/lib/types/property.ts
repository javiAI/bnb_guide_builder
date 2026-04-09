export const PROPERTY_STATUS = {
  draft: "draft",
  active: "active",
  archived: "archived",
} as const;

export type PropertyStatus = (typeof PROPERTY_STATUS)[keyof typeof PROPERTY_STATUS];

export interface Property {
  id: string;
  workspaceId: string;
  propertyNickname: string;
  propertyType: string | null;
  roomType: string | null;
  country: string | null;
  city: string | null;
  timezone: string | null;
  maxGuests: number | null;
  bedroomsCount: number | null;
  bedsCount: number | null;
  bathroomsCount: number | null;
  status: PropertyStatus;
  createdAt: string;
  updatedAt: string;
}

export const STATUS_LABELS: Record<PropertyStatus, string> = {
  draft: "Borrador",
  active: "Activa",
  archived: "Archivada",
};

export const STATUS_TONES: Record<PropertyStatus, BadgeTone> = {
  draft: "warning",
  active: "success",
  archived: "neutral",
};

export type BadgeTone = "neutral" | "success" | "warning" | "danger";
