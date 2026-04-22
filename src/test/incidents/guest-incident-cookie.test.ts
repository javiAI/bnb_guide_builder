// HMAC-signed guest incident cookie (rama 13D). The cookie is the only
// authorizer for `GET /api/g/:slug/incidents/:id` — if these invariants
// relax, any guest could enumerate incidents by id.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  buildGuestIncidentCookieValue,
  parseGuestIncidentCookieValue,
  appendIncidentIdToCookie,
  guestIncidentCookieName,
  GUEST_INCIDENT_COOKIE_TTL_SECONDS,
  MAX_IDS_PER_COOKIE,
} from "@/lib/services/guest-incident-cookie";

describe("guest-incident-cookie", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-22T12:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("builds and round-trips a cookie for a slug", () => {
    const cookie = buildGuestIncidentCookieValue("sunset-villa", ["inc1", "inc2"]);
    const parsed = parseGuestIncidentCookieValue(cookie, "sunset-villa");
    expect(parsed).not.toBeNull();
    expect(parsed?.ids).toEqual(["inc1", "inc2"]);
  });

  it("rejects a cookie signed for a different slug", () => {
    const cookie = buildGuestIncidentCookieValue("sunset-villa", ["inc1"]);
    const parsed = parseGuestIncidentCookieValue(cookie, "other-slug");
    expect(parsed).toBeNull();
  });

  it("rejects a tampered signature", () => {
    const cookie = buildGuestIncidentCookieValue("sunset-villa", ["inc1"]);
    const [payload, sig] = cookie.split(".");
    const tampered = `${payload}.${sig.slice(0, -2)}aa`;
    expect(parseGuestIncidentCookieValue(tampered, "sunset-villa")).toBeNull();
  });

  it("rejects a tampered payload (keeps original signature)", () => {
    const cookie = buildGuestIncidentCookieValue("sunset-villa", ["inc1"]);
    const [payload, sig] = cookie.split(".");
    // flip one char in payload
    const tamperedPayload = payload.replace(/.$/, (c) =>
      c === "A" ? "B" : "A",
    );
    expect(
      parseGuestIncidentCookieValue(`${tamperedPayload}.${sig}`, "sunset-villa"),
    ).toBeNull();
  });

  it("rejects cookies older than the TTL", () => {
    const cookie = buildGuestIncidentCookieValue("sunset-villa", ["inc1"]);
    // advance past TTL
    vi.setSystemTime(
      new Date("2026-04-22T12:00:00Z").getTime() +
        (GUEST_INCIDENT_COOKIE_TTL_SECONDS + 10) * 1000,
    );
    expect(parseGuestIncidentCookieValue(cookie, "sunset-villa")).toBeNull();
  });

  it("rejects cookies with clock-skewed mintedAt in the future", () => {
    vi.setSystemTime(new Date("2026-04-22T12:00:00Z"));
    const cookie = buildGuestIncidentCookieValue("sunset-villa", ["inc1"]);
    // move the clock BACK by 10 minutes → the cookie's mintedAt is now 10m
    // in the future relative to "now". The guard rejects anything >5m ahead.
    vi.setSystemTime(new Date("2026-04-22T11:50:00Z"));
    expect(parseGuestIncidentCookieValue(cookie, "sunset-villa")).toBeNull();
  });

  it("appends a new incident id to an existing cookie", () => {
    const first = buildGuestIncidentCookieValue("sunset-villa", ["inc1"]);
    const next = appendIncidentIdToCookie("sunset-villa", first, "inc2");
    const parsed = parseGuestIncidentCookieValue(next, "sunset-villa");
    expect(parsed?.ids).toEqual(["inc1", "inc2"]);
  });

  it("drops oldest ids when appending past MAX_IDS_PER_COOKIE", () => {
    const ids = Array.from(
      { length: MAX_IDS_PER_COOKIE },
      (_, i) => `inc${i}`,
    );
    let cookie = buildGuestIncidentCookieValue("sunset-villa", ids);
    cookie = appendIncidentIdToCookie("sunset-villa", cookie, "new-one");
    const parsed = parseGuestIncidentCookieValue(cookie, "sunset-villa");
    expect(parsed?.ids.length).toBe(MAX_IDS_PER_COOKIE);
    expect(parsed?.ids[parsed.ids.length - 1]).toBe("new-one");
    expect(parsed?.ids.includes("inc0")).toBe(false);
  });

  it("dedupes when appending an id that already exists", () => {
    const first = buildGuestIncidentCookieValue("sunset-villa", ["inc1"]);
    const next = appendIncidentIdToCookie("sunset-villa", first, "inc1");
    const parsed = parseGuestIncidentCookieValue(next, "sunset-villa");
    expect(parsed?.ids).toEqual(["inc1"]);
  });

  it("namespaces cookie name per slug", () => {
    expect(guestIncidentCookieName("a")).not.toBe(guestIncidentCookieName("b"));
    expect(guestIncidentCookieName("a")).toContain("a");
  });

  it("handles an empty-cookie append gracefully", () => {
    const cookie = appendIncidentIdToCookie("sunset-villa", null, "inc1");
    const parsed = parseGuestIncidentCookieValue(cookie, "sunset-villa");
    expect(parsed?.ids).toEqual(["inc1"]);
  });
});
