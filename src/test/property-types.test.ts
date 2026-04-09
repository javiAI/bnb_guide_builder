import { describe, it, expect } from "vitest";
import {
  PROPERTY_STATUS,
  STATUS_LABELS,
  STATUS_TONES,
  type PropertyStatus,
} from "@/lib/types";

describe("Property status model", () => {
  it("defines three statuses: draft, active, archived", () => {
    expect(Object.values(PROPERTY_STATUS)).toEqual(["draft", "active", "archived"]);
  });

  it("has Spanish labels for all statuses", () => {
    const statuses = Object.values(PROPERTY_STATUS) as PropertyStatus[];
    statuses.forEach((status) => {
      expect(STATUS_LABELS[status]).toBeDefined();
      expect(typeof STATUS_LABELS[status]).toBe("string");
    });
    expect(STATUS_LABELS.draft).toBe("Borrador");
    expect(STATUS_LABELS.active).toBe("Activa");
    expect(STATUS_LABELS.archived).toBe("Archivada");
  });

  it("has valid tones for all statuses", () => {
    const validTones = ["neutral", "success", "warning", "danger"];
    const statuses = Object.values(PROPERTY_STATUS) as PropertyStatus[];
    statuses.forEach((status) => {
      expect(validTones).toContain(STATUS_TONES[status]);
    });
  });
});
