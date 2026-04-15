import { describe, it, expect } from "vitest";
import {
  instanceKeyFor,
  spaceIdFromInstanceKey,
  isCanonicalInstanceKey,
} from "@/lib/amenity-instance-keys";

describe("amenity-instance-keys", () => {
  describe("instanceKeyFor", () => {
    it("maps null spaceId to 'default'", () => {
      expect(instanceKeyFor(null)).toBe("default");
    });

    it("maps concrete spaceId to 'space:<id>'", () => {
      expect(instanceKeyFor("s1")).toBe("space:s1");
      expect(instanceKeyFor("cuid_abc123")).toBe("space:cuid_abc123");
    });
  });

  describe("spaceIdFromInstanceKey", () => {
    it("returns null for 'default'", () => {
      expect(spaceIdFromInstanceKey("default")).toBeNull();
    });

    it("extracts spaceId from canonical 'space:<id>'", () => {
      expect(spaceIdFromInstanceKey("space:s1")).toBe("s1");
      expect(spaceIdFromInstanceKey("space:cuid_abc123")).toBe("cuid_abc123");
    });

    it("returns null for non-canonical keys", () => {
      expect(spaceIdFromInstanceKey("custom-key")).toBeNull();
      expect(spaceIdFromInstanceKey("tea-v1")).toBeNull();
    });

    it("returns null for 'space:' with empty suffix", () => {
      // Guards against a false-canonical slot that would silently collapse
      // to property-scope (spaceId = null) on the round-trip.
      expect(spaceIdFromInstanceKey("space:")).toBeNull();
    });
  });

  describe("isCanonicalInstanceKey", () => {
    it("accepts 'default'", () => {
      expect(isCanonicalInstanceKey("default")).toBe(true);
    });

    it("accepts 'space:<id>' with non-empty suffix", () => {
      expect(isCanonicalInstanceKey("space:s1")).toBe(true);
    });

    it("rejects 'space:' with empty suffix", () => {
      expect(isCanonicalInstanceKey("space:")).toBe(false);
    });

    it("rejects custom keys", () => {
      expect(isCanonicalInstanceKey("custom-key")).toBe(false);
      expect(isCanonicalInstanceKey("")).toBe(false);
    });
  });

  describe("round-trip invariant", () => {
    it("spaceIdFromInstanceKey(instanceKeyFor(x)) === x for canonical x", () => {
      expect(spaceIdFromInstanceKey(instanceKeyFor(null))).toBeNull();
      expect(spaceIdFromInstanceKey(instanceKeyFor("s1"))).toBe("s1");
      expect(spaceIdFromInstanceKey(instanceKeyFor("cuid_xyz"))).toBe("cuid_xyz");
    });
  });
});
