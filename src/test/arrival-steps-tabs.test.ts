import { describe, expect, it } from "vitest";
import {
  TAB_KEYS_ORDER,
  computeVisibleTabs,
  type ArrivalParkingPlaceShape,
  type ArrivalTransitOptionShape,
} from "@/app/properties/[propertyId]/access/_components/arrival-steps-helpers";

function parking(
  overrides: Partial<ArrivalParkingPlaceShape> = {},
): ArrivalParkingPlaceShape {
  return {
    id: "p1",
    latitude: 40.4,
    longitude: -3.7,
    feeType: "free",
    ...overrides,
  };
}

function transit(
  overrides: Partial<ArrivalTransitOptionShape> = {},
): ArrivalTransitOptionShape {
  return {
    id: "t1",
    mode: "train",
    ...overrides,
  };
}

describe("arrival-steps · paso 01 tabs", () => {
  it("TAB_KEYS_ORDER mirrors section-2 intercity modes: coche → tren → bus → avión", () => {
    expect(TAB_KEYS_ORDER).toEqual(["coche", "train", "bus", "airport"]);
  });

  it("computeVisibleTabs returns empty array when no options exist", () => {
    expect(computeVisibleTabs([], [])).toEqual([]);
  });

  it("computeVisibleTabs surfaces coche only when ≥1 parking place exists", () => {
    expect(computeVisibleTabs([parking()], [])).toEqual(["coche"]);
  });

  it("computeVisibleTabs surfaces only modes with options, in canonical order", () => {
    const tabs = computeVisibleTabs(
      [parking()],
      [
        transit({ id: "t-train", mode: "train" }),
        transit({ id: "t-airport", mode: "airport" }),
      ],
    );
    expect(tabs).toEqual(["coche", "train", "airport"]);
  });

  it("computeVisibleTabs omits coche when no parking even if transit options exist", () => {
    const tabs = computeVisibleTabs(
      [],
      [transit({ id: "t1", mode: "bus" })],
    );
    expect(tabs).toEqual(["bus"]);
  });

  it("computeVisibleTabs respects canonical order regardless of input order", () => {
    const tabs = computeVisibleTabs(
      [],
      [
        transit({ id: "t-airport", mode: "airport" }),
        transit({ id: "t-bus", mode: "bus" }),
        transit({ id: "t-train", mode: "train" }),
      ],
    );
    expect(tabs).toEqual(["train", "bus", "airport"]);
  });

  it("computeVisibleTabs respects enabledModes when provided", () => {
    const tabs = computeVisibleTabs(
      [parking()],
      [transit({ mode: "train" }), transit({ id: "t-bus", mode: "bus" })],
      { parking: true, train: false, bus: true, airport: false },
    );
    expect(tabs).toEqual(["coche", "bus"]);
  });

  it("computeVisibleTabs treats coche enable via the `parking` key", () => {
    const tabs = computeVisibleTabs(
      [parking()],
      [],
      { parking: false, train: true, bus: true, airport: true },
    );
    expect(tabs).toEqual([]);
  });
});
