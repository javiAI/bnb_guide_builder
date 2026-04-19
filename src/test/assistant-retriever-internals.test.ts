import { describe, it, expect } from "vitest";
import {
  allowedVisibilitiesFor,
  __retriever_internal,
} from "@/lib/services/assistant/retriever";

const { buildTsQuery, fuse, RRF_K } = __retriever_internal;

describe("retriever — visibility leak invariant", () => {
  it("sensitive is NEVER in the allowed list for any audience", () => {
    for (const audience of ["guest", "ai", "internal", "sensitive"] as const) {
      const allowed = allowedVisibilitiesFor(audience);
      expect(allowed).not.toContain("sensitive");
    }
  });

  it("guest only sees guest", () => {
    expect(allowedVisibilitiesFor("guest")).toEqual(["guest"]);
  });

  it("ai sees guest + ai", () => {
    const a = allowedVisibilitiesFor("ai").sort();
    expect(a).toEqual(["ai", "guest"]);
  });

  it("internal sees guest + ai + internal (but still not sensitive)", () => {
    const a = allowedVisibilitiesFor("internal").sort();
    expect(a).toEqual(["ai", "guest", "internal"]);
  });
});

describe("retriever — BM25 tsquery sanitizer", () => {
  it("lowercases + strips accents + OR-joins prefix tokens", () => {
    expect(buildTsQuery("Cómo enciendo la Calefacción?")).toBe(
      "como:* | enciendo:* | la:* | calefaccion:*",
    );
  });

  it("drops 1-char tokens and punctuation", () => {
    expect(buildTsQuery("a WiFi?")).toBe("wifi:*");
  });

  it("returns empty string on empty / whitespace / punctuation only", () => {
    expect(buildTsQuery("")).toBe("");
    expect(buildTsQuery("   ")).toBe("");
    expect(buildTsQuery("!!!")).toBe("");
  });
});

describe("retriever — RRF fusion", () => {
  const stub = (id: string, score: number) => ({
    id,
    property_id: "p",
    topic: id,
    body_md: "",
    locale: "es",
    visibility: "guest" as const,
    journey_stage: "any" as const,
    chunk_type: "fact" as const,
    entity_type: "property" as const,
    entity_id: null,
    canonical_question: null,
    context_prefix: "",
    tags: [],
    source_fields: [],
    score,
  });

  it("items appearing in both channels rank higher than single-channel items", () => {
    const bm25 = [stub("a", 0.9), stub("b", 0.5)];
    const vector = [stub("a", 0.8), stub("c", 0.7)];
    const out = fuse(bm25, vector, 5);
    expect(out[0].id).toBe("a");
    // expected RRF for "a" = 1/(60+1) + 1/(60+1) ≈ 0.0328
    expect(out[0].rrfScore).toBeCloseTo(2 / (RRF_K + 1), 5);
    // single-channel items all tie at rank 1
    expect(out.slice(1).every((r) => r.rrfScore < out[0].rrfScore)).toBe(true);
  });

  it("preserves per-channel scores on the output", () => {
    const bm25 = [stub("a", 0.42)];
    const vector = [stub("a", 0.73)];
    const out = fuse(bm25, vector, 5);
    expect(out[0].bm25Score).toBe(0.42);
    expect(out[0].vectorScore).toBe(0.73);
  });

  it("respects topK", () => {
    const bm25 = Array.from({ length: 10 }, (_, i) => stub(`x${i}`, 10 - i));
    const out = fuse(bm25, [], 3);
    expect(out).toHaveLength(3);
  });
});
