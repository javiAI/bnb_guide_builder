import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    property: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/services/guide-local-data", () => ({
  getLocalPlacesForProperty: vi.fn(),
  getLocalEventsForProperty: vi.fn(),
}));

import { prisma } from "@/lib/db";
import {
  getLocalEventsForProperty,
  getLocalPlacesForProperty,
} from "@/lib/services/guide-local-data";
import {
  buildGuideLocalEventsData,
  buildGuideMapData,
} from "@/lib/services/guide-map.service";

const mockProperty = prisma.property.findUnique as unknown as ReturnType<
  typeof vi.fn
>;
const mockPlaces = getLocalPlacesForProperty as unknown as ReturnType<
  typeof vi.fn
>;
const mockEvents = getLocalEventsForProperty as unknown as ReturnType<
  typeof vi.fn
>;

// Fixed "now" keeps the temporal-window assertions crisp.
const NOW = new Date("2026-04-21T12:00:00.000Z");
const EIGHT_DAYS_AHEAD = new Date(NOW.getTime() + 8 * 24 * 60 * 60 * 1000);
const TWELVE_HOURS_AGO = new Date(NOW.getTime() - 12 * 60 * 60 * 1000);
const TWO_DAYS_AGO = new Date(NOW.getTime() - 48 * 60 * 60 * 1000);
const FORTY_DAYS_AHEAD = new Date(NOW.getTime() + 40 * 24 * 60 * 60 * 1000);

const MADRID_LAT = 40.4168;
const MADRID_LNG = -3.7038;

function placeRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "pl-default",
    categoryKey: "lp.restaurant",
    name: "Casa Pepe",
    guestDescription: null,
    aiNotes: null,
    distanceMeters: 200,
    hoursText: null,
    latitude: 40.4180,
    longitude: -3.7050,
    visibility: "guest" as const,
    ...overrides,
  };
}

function eventRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "ev-default",
    title: "Concierto en el parque",
    descriptionMd: null,
    categoryKey: "le.music",
    startsAt: EIGHT_DAYS_AHEAD,
    endsAt: null,
    venueName: "Parque del Retiro",
    latitude: 40.4150,
    longitude: -3.6840,
    sourceUrl: "https://example.com/e/1",
    ...overrides,
  };
}

beforeEach(() => {
  mockProperty.mockReset();
  mockPlaces.mockReset();
  mockEvents.mockReset();
  mockProperty.mockResolvedValue({
    id: "p1",
    latitude: MADRID_LAT,
    longitude: MADRID_LNG,
  });
  mockPlaces.mockResolvedValue([]);
  mockEvents.mockResolvedValue([]);
});

describe("buildGuideMapData — audience gate on anchor", () => {
  it("obfuscates the anchor for audience=guest", async () => {
    const out = await buildGuideMapData("p1", "guest", { now: NOW });
    expect(out).not.toBeNull();
    expect(out!.anchor).not.toBeNull();
    expect(out!.anchor!.obfuscated).toBe(true);
    // The exact coords must not appear.
    expect(out!.anchor!.lat).not.toBe(MADRID_LAT);
    expect(out!.anchor!.lng).not.toBe(MADRID_LNG);
    if (out!.anchor!.obfuscated) {
      expect(out!.anchor!.radiusMeters).toBe(300);
    }
  });

  it("emits exact coordinates only for audience=internal", async () => {
    const out = await buildGuideMapData("p1", "internal", { now: NOW });
    expect(out!.anchor!.obfuscated).toBe(false);
    expect(out!.anchor!.lat).toBe(MADRID_LAT);
    expect(out!.anchor!.lng).toBe(MADRID_LNG);
  });

  it("obfuscates for audience=ai (never surfaces exact coords)", async () => {
    const out = await buildGuideMapData("p1", "ai", { now: NOW });
    expect(out!.anchor!.obfuscated).toBe(true);
    expect(out!.anchor!.lat).not.toBe(MADRID_LAT);
  });

  it("returns null for audience=sensitive (hard gate)", async () => {
    const out = await buildGuideMapData("p1", "sensitive", { now: NOW });
    expect(out).toBeNull();
  });

  it("returns null when the property does not exist", async () => {
    mockProperty.mockResolvedValueOnce(null);
    const out = await buildGuideMapData("p-missing", "guest", { now: NOW });
    expect(out).toBeNull();
  });

  it("emits anchor=null when the property has no coordinates but still builds pins", async () => {
    mockProperty.mockResolvedValueOnce({ id: "p1", latitude: null, longitude: null });
    mockPlaces.mockResolvedValueOnce([
      placeRow({ id: "pl-1", latitude: 40.4, longitude: -3.7 }),
    ]);
    const out = await buildGuideMapData("p1", "guest", { now: NOW });
    expect(out!.anchor).toBeNull();
    expect(out!.pins).toHaveLength(1);
  });
});

describe("buildGuideMapData — LocalPlace visibility gate", () => {
  it("emits a pin for a guest-visible place with coordinates", async () => {
    mockPlaces.mockResolvedValueOnce([
      placeRow({ id: "pl-1", visibility: "guest" }),
    ]);
    const out = await buildGuideMapData("p1", "guest", { now: NOW });
    expect(out!.pins).toHaveLength(1);
    expect(out!.pins[0].kind).toBe("place");
  });

  it("excludes an internal-only place when audience=guest", async () => {
    mockPlaces.mockResolvedValueOnce([
      placeRow({ id: "pl-1", visibility: "internal" }),
    ]);
    const out = await buildGuideMapData("p1", "guest", { now: NOW });
    expect(out!.pins).toHaveLength(0);
  });

  it("includes an internal place when audience=internal", async () => {
    mockPlaces.mockResolvedValueOnce([
      placeRow({ id: "pl-1", visibility: "internal" }),
    ]);
    const out = await buildGuideMapData("p1", "internal", { now: NOW });
    expect(out!.pins).toHaveLength(1);
  });

  it("excludes places without coordinates", async () => {
    mockPlaces.mockResolvedValueOnce([
      placeRow({ id: "pl-1", latitude: null, longitude: null }),
    ]);
    const out = await buildGuideMapData("p1", "guest", { now: NOW });
    expect(out!.pins).toHaveLength(0);
  });

  it("never exposes a sensitive place regardless of audience", async () => {
    mockPlaces.mockResolvedValueOnce([
      placeRow({ id: "pl-1", visibility: "sensitive" }),
    ]);
    const outGuest = await buildGuideMapData("p1", "guest", { now: NOW });
    const outInternal = await buildGuideMapData("p1", "internal", { now: NOW });
    expect(outGuest!.pins).toHaveLength(0);
    expect(outInternal!.pins).toHaveLength(0);
  });
});

describe("buildGuideMapData — LocalEvent pin rules", () => {
  it("emits a pin for an event with coordinates inside the window", async () => {
    mockEvents.mockResolvedValueOnce([
      eventRow({ id: "ev-1", startsAt: EIGHT_DAYS_AHEAD }),
    ]);
    const out = await buildGuideMapData("p1", "guest", { now: NOW });
    expect(out!.pins).toHaveLength(1);
    expect(out!.pins[0].kind).toBe("event");
    if (out!.pins[0].kind === "event") {
      expect(out!.pins[0].startsAt).toBe(EIGHT_DAYS_AHEAD.toISOString());
    }
  });

  it("excludes events without coordinates from the map (they still make the listing)", async () => {
    mockEvents.mockResolvedValueOnce([
      eventRow({ id: "ev-1", latitude: null, longitude: null }),
    ]);
    const out = await buildGuideMapData("p1", "guest", { now: NOW });
    expect(out!.pins).toHaveLength(0);
  });

  it("excludes events more than 30 days in the future", async () => {
    mockEvents.mockResolvedValueOnce([
      eventRow({ id: "ev-1", startsAt: FORTY_DAYS_AHEAD }),
    ]);
    const out = await buildGuideMapData("p1", "guest", { now: NOW });
    expect(out!.pins).toHaveLength(0);
  });

  it("excludes events started more than 24h ago", async () => {
    mockEvents.mockResolvedValueOnce([
      eventRow({ id: "ev-1", startsAt: TWO_DAYS_AGO }),
    ]);
    const out = await buildGuideMapData("p1", "guest", { now: NOW });
    expect(out!.pins).toHaveLength(0);
  });

  it("includes events that started within the last 24h", async () => {
    mockEvents.mockResolvedValueOnce([
      eventRow({ id: "ev-1", startsAt: TWELVE_HOURS_AGO }),
    ]);
    const out = await buildGuideMapData("p1", "guest", { now: NOW });
    expect(out!.pins).toHaveLength(1);
  });
});

describe("buildGuideLocalEventsData — temporal listing", () => {
  it("orders items by startsAt ascending", async () => {
    const a = new Date(NOW.getTime() + 10 * 24 * 60 * 60 * 1000);
    const b = new Date(NOW.getTime() + 5 * 24 * 60 * 60 * 1000);
    const c = new Date(NOW.getTime() + 1 * 24 * 60 * 60 * 1000);
    // Helper sorts ASC internally, but the test feeds them in a scrambled
    // order to make the invariant explicit.
    mockEvents.mockResolvedValueOnce([
      eventRow({ id: "ev-c", startsAt: c }),
      eventRow({ id: "ev-a", startsAt: a }),
      eventRow({ id: "ev-b", startsAt: b }),
    ]);
    const out = await buildGuideLocalEventsData("p1", "guest", { now: NOW });
    expect(out.items.map((it) => it.id)).toEqual(["ev-c", "ev-b", "ev-a"]);
  });

  it("includes events without coordinates in the listing (hasCoords=false)", async () => {
    mockEvents.mockResolvedValueOnce([
      eventRow({ id: "ev-1", latitude: null, longitude: null }),
    ]);
    const out = await buildGuideLocalEventsData("p1", "guest", { now: NOW });
    expect(out.items).toHaveLength(1);
    expect(out.items[0].hasCoords).toBe(false);
  });

  it("respects the same temporal window as the map", async () => {
    mockEvents.mockResolvedValueOnce([
      eventRow({ id: "ev-past", startsAt: TWO_DAYS_AGO }),
      eventRow({ id: "ev-in-window", startsAt: EIGHT_DAYS_AHEAD }),
      eventRow({ id: "ev-far", startsAt: FORTY_DAYS_AHEAD }),
    ]);
    const out = await buildGuideLocalEventsData("p1", "guest", { now: NOW });
    expect(out.items.map((it) => it.id)).toEqual(["ev-in-window"]);
  });

  it("returns an empty list for audience=sensitive", async () => {
    mockEvents.mockResolvedValueOnce([eventRow({ id: "ev-1" })]);
    const out = await buildGuideLocalEventsData("p1", "sensitive", { now: NOW });
    expect(out.items).toEqual([]);
  });

  it("marks hasCoords=true when both latitude and longitude are present", async () => {
    mockEvents.mockResolvedValueOnce([eventRow({ id: "ev-1" })]);
    const out = await buildGuideLocalEventsData("p1", "guest", { now: NOW });
    expect(out.items[0].hasCoords).toBe(true);
  });
});

describe("buildGuideMapData — property-coord leak invariants", () => {
  // Rama 13C canonical rule: Property.latitude / Property.longitude never
  // appear in serialized guest/ai output. The *only* path that emits exact
  // coordinates is audience=internal. Strings are matched literally so the
  // invariant catches both JSON-serialized and pretty-printed shapes.
  const EXACT_LAT_STR = String(MADRID_LAT);
  const EXACT_LNG_STR = String(MADRID_LNG);

  it("does not emit the exact property lat/lng for audience=guest", async () => {
    const out = await buildGuideMapData("p1", "guest", { now: NOW });
    const serialized = JSON.stringify(out);
    expect(serialized).not.toContain(EXACT_LAT_STR);
    expect(serialized).not.toContain(EXACT_LNG_STR);
  });

  it("does not emit the exact property lat/lng for audience=ai", async () => {
    const out = await buildGuideMapData("p1", "ai", { now: NOW });
    const serialized = JSON.stringify(out);
    expect(serialized).not.toContain(EXACT_LAT_STR);
    expect(serialized).not.toContain(EXACT_LNG_STR);
  });

  it("DOES emit the exact property lat/lng for audience=internal (the only audience allowed to see them)", async () => {
    const out = await buildGuideMapData("p1", "internal", { now: NOW });
    const serialized = JSON.stringify(out);
    expect(serialized).toContain(EXACT_LAT_STR);
    expect(serialized).toContain(EXACT_LNG_STR);
  });

  it("guest events listing never surfaces the property anchor coords (the temporal payload has none to begin with)", async () => {
    mockEvents.mockResolvedValueOnce([
      eventRow({ id: "ev-1", startsAt: EIGHT_DAYS_AHEAD }),
    ]);
    const out = await buildGuideLocalEventsData("p1", "guest", { now: NOW });
    const serialized = JSON.stringify(out);
    expect(serialized).not.toContain(EXACT_LAT_STR);
    expect(serialized).not.toContain(EXACT_LNG_STR);
  });
});
