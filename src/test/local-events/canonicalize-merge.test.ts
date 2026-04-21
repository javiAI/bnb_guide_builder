import { describe, it, expect } from "vitest";
import {
  canonicalizeCandidates,
  deriveCanonicalKey,
  normalizeTitle,
  normalizeVenue,
  titleSimilarity,
  providerFamily,
  familyPriority,
  startSlot,
} from "@/lib/services/local-events/canonicalize";
import { mergeCanonicalGroup } from "@/lib/services/local-events/merge";
import type { NormalizedEventCandidate } from "@/lib/services/local-events/contracts";

function candidate(overrides: Partial<NormalizedEventCandidate> = {}): NormalizedEventCandidate {
  const base: NormalizedEventCandidate = {
    source: "predicthq",
    sourceExternalId: "phq-1",
    sourceUrl: "https://www.predicthq.com/events/phq-1",
    title: "Concierto de la Orquesta Nacional",
    categoryKey: "le.concert",
    startsAt: new Date("2026-05-10T19:00:00.000Z"),
    venueName: "Auditorio Nacional",
    venueAddress: "C/ Principe de Vergara 146, Madrid",
    latitude: 40.441,
    longitude: -3.676,
    confidence: 0.72,
    providerMetadata: {
      nativeCategory: "concerts",
      nativeTypes: ["music"],
      confidence: 0.72,
      retrievedAt: "2026-04-21T08:00:00.000Z",
    },
    retrievedAt: "2026-04-21T08:00:00.000Z",
  };
  return { ...base, ...overrides };
}

describe("normalization helpers", () => {
  it("normalizeTitle collapses case, accents, punctuation, whitespace", () => {
    expect(normalizeTitle("Concierto ¡Orquesta! Nacional")).toBe("concierto orquesta nacional");
    expect(normalizeTitle("CONCIERTO  orquesta  nacional")).toBe("concierto orquesta nacional");
  });

  it("normalizeVenue collapses blank and punctuation", () => {
    expect(normalizeVenue("Palau de la Música")).toBe("palau de la musica");
    expect(normalizeVenue(undefined)).toBe("");
  });

  it("titleSimilarity is token-set Jaccard", () => {
    expect(titleSimilarity("Concierto Orquesta Nacional", "Concierto Orquesta Nacional")).toBe(1);
    expect(titleSimilarity("Concierto Orquesta Nacional", "Concierto Orquesta")).toBeGreaterThan(0.5);
    expect(titleSimilarity("Concierto", "Partido de Futbol")).toBeLessThan(0.1);
  });

  it("providerFamily strips instance suffix", () => {
    expect(providerFamily("predicthq")).toBe("predicthq");
    expect(providerFamily("firecrawl:teruel_turismo")).toBe("firecrawl");
    expect(providerFamily("ticketmaster")).toBe("ticketmaster");
  });

  it("familyPriority reads PROVIDER_PRIORITY", () => {
    expect(familyPriority("predicthq")).toBe(100);
    expect(familyPriority("firecrawl:anything")).toBe(80);
    expect(familyPriority("ticketmaster")).toBe(60);
    expect(familyPriority("unknown")).toBe(0);
  });

  it("startSlot floors to 15 minutes", () => {
    const base = new Date("2026-05-10T19:00:00.000Z");
    const plus14 = new Date("2026-05-10T19:14:00.000Z");
    const plus15 = new Date("2026-05-10T19:15:00.000Z");
    expect(startSlot(base)).toBe(startSlot(plus14));
    expect(startSlot(base)).not.toBe(startSlot(plus15));
  });

  it("deriveCanonicalKey is stable across minor drift", () => {
    const a = deriveCanonicalKey(candidate({ title: "Concierto Orquesta", startsAt: new Date("2026-05-10T19:00:00.000Z"), venueName: "Auditorio" }));
    const b = deriveCanonicalKey(candidate({ title: "CONCIERTO Orquesta", startsAt: new Date("2026-05-10T19:04:00.000Z"), venueName: "auditorio" }));
    expect(a).toBe(b);
  });
});

describe("canonicalizeCandidates", () => {
  it("strong-matches identical title+slot+venue across sources", () => {
    const groups = canonicalizeCandidates([
      candidate({ source: "predicthq", sourceExternalId: "phq-1" }),
      candidate({ source: "ticketmaster", sourceExternalId: "tm-1" }),
      candidate({ source: "firecrawl:teruel_turismo", sourceExternalId: "fc-1" }),
    ]);
    expect(groups.length).toBe(1);
    expect(groups[0].candidates.length).toBe(3);
    expect(groups[0].matchKind).toBe("strong");
  });

  it("keeps distinct canonical rows for genuinely different events", () => {
    const groups = canonicalizeCandidates([
      candidate({ source: "predicthq", sourceExternalId: "phq-1", title: "Concierto A" }),
      candidate({
        source: "ticketmaster",
        sourceExternalId: "tm-1",
        title: "Partido de Futbol",
        categoryKey: "le.sports",
        startsAt: new Date("2026-05-12T21:00:00.000Z"),
        venueName: "Santiago Bernabeu",
      }),
    ]);
    expect(groups.length).toBe(2);
  });

  it("uses heuristic match when start differs by <60 min and title tokens overlap", () => {
    const groups = canonicalizeCandidates([
      candidate({
        source: "predicthq",
        sourceExternalId: "phq-1",
        title: "Concierto Orquesta Nacional",
        startsAt: new Date("2026-05-10T19:00:00.000Z"),
      }),
      candidate({
        source: "ticketmaster",
        sourceExternalId: "tm-1",
        title: "Orquesta Nacional — Concierto",
        startsAt: new Date("2026-05-10T19:30:00.000Z"),
      }),
    ]);
    expect(groups.length).toBe(1);
    expect(groups[0].matchKind).toBe("heuristic");
  });

  it("heuristic matches by geographic proximity when venue names disagree", () => {
    const groups = canonicalizeCandidates([
      candidate({
        source: "predicthq",
        sourceExternalId: "phq-1",
        title: "Concierto de Verano",
        venueName: "Auditorio Nacional",
        latitude: 40.441,
        longitude: -3.676,
        startsAt: new Date("2026-05-10T19:00:00.000Z"),
      }),
      candidate({
        source: "ticketmaster",
        sourceExternalId: "tm-1",
        title: "Concierto Verano Orquesta",
        venueName: "Aud. Nacional de Musica",
        latitude: 40.4412,
        longitude: -3.6762,
        startsAt: new Date("2026-05-10T19:15:00.000Z"),
      }),
    ]);
    expect(groups.length).toBe(1);
    expect(groups[0].matchKind).toBe("heuristic");
  });

  it("does NOT merge when similarity is below the conservative threshold", () => {
    // Same venue+slot but nothing in common in titles → conservative: keep separate.
    const groups = canonicalizeCandidates([
      candidate({
        source: "predicthq",
        sourceExternalId: "phq-1",
        title: "Espectaculo A",
        venueName: "Auditorio Nacional",
        startsAt: new Date("2026-05-10T19:00:00.000Z"),
      }),
      candidate({
        source: "ticketmaster",
        sourceExternalId: "tm-1",
        title: "Partido de Tenis Final",
        venueName: "Auditorio Nacional",
        startsAt: new Date("2026-05-10T19:30:00.000Z"),
      }),
    ]);
    expect(groups.length).toBe(2);
  });

  it("seeds groups in priority order so strong matches land on best candidate", () => {
    // Scramble input order; the seed of the single group must still be PHQ.
    const groups = canonicalizeCandidates([
      candidate({ source: "ticketmaster", sourceExternalId: "tm-1" }),
      candidate({ source: "firecrawl:teruel_turismo", sourceExternalId: "fc-1" }),
      candidate({ source: "predicthq", sourceExternalId: "phq-1" }),
    ]);
    expect(groups.length).toBe(1);
    expect(groups[0].candidates[0].source).toBe("predicthq");
  });
});

describe("mergeCanonicalGroup", () => {
  it("picks PHQ as primary and uses PHQ's descriptive fields when the group strong-matches", () => {
    // Same title+slot+venue → strong match → one group.
    const groups = canonicalizeCandidates([
      candidate({
        source: "predicthq",
        sourceExternalId: "phq-1",
        descriptionMd: "phq description",
        venueName: "Auditorio",
      }),
      candidate({
        source: "ticketmaster",
        sourceExternalId: "tm-1",
        descriptionMd: "tm description",
        sourceUrl: "https://www.ticketmaster.es/event/tm-1",
        imageUrl: "https://tm/img.jpg",
        venueName: "Auditorio",
      }),
    ]);
    expect(groups.length).toBe(1);

    const merged = mergeCanonicalGroup(groups[0]);
    expect(merged.primarySource).toBe("predicthq");
    // priority pick → PHQ wins narrative fields (description)
    expect(merged.descriptionMd).toBe("phq description");
    // TM wins sourceUrl (clickable override)
    expect(merged.sourceUrl).toBe("https://www.ticketmaster.es/event/tm-1");
    // TM's image used because Firecrawl not present — byPriority fallback
    expect(merged.imageUrl).toBe("https://tm/img.jpg");
    expect(merged.contributingSources).toEqual(["predicthq", "ticketmaster"]);
  });

  it("Firecrawl wins imageUrl when present", () => {
    const groups = canonicalizeCandidates([
      candidate({
        source: "predicthq",
        sourceExternalId: "phq-1",
        imageUrl: "https://predicthq/img.jpg",
        venueName: "Auditorio",
      }),
      candidate({
        source: "firecrawl:teruel_turismo",
        sourceExternalId: "fc-1",
        imageUrl: "https://turismo.teruel/img.jpg",
        venueName: "Auditorio",
      }),
      candidate({
        source: "ticketmaster",
        sourceExternalId: "tm-1",
        imageUrl: "https://tm/img.jpg",
        venueName: "Auditorio",
      }),
    ]);
    const merged = mergeCanonicalGroup(groups[0]);
    expect(merged.imageUrl).toBe("https://turismo.teruel/img.jpg");
  });

  it("TM wins sourceUrl even when PHQ is primary", () => {
    const groups = canonicalizeCandidates([
      candidate({
        source: "predicthq",
        sourceExternalId: "phq-1",
        sourceUrl: "https://www.predicthq.com/events/phq-1",
      }),
      candidate({
        source: "ticketmaster",
        sourceExternalId: "tm-1",
        sourceUrl: "https://www.ticketmaster.es/event/tm-1",
      }),
    ]);
    const merged = mergeCanonicalGroup(groups[0]);
    expect(merged.primarySource).toBe("predicthq");
    expect(merged.sourceUrl).toBe("https://www.ticketmaster.es/event/tm-1");
  });

  it("falls back to the next source when primary lacks a field", () => {
    const groups = canonicalizeCandidates([
      candidate({
        source: "predicthq",
        sourceExternalId: "phq-1",
        descriptionMd: undefined,
        venueName: "Auditorio",
      }),
      candidate({
        source: "firecrawl:teruel_turismo",
        sourceExternalId: "fc-1",
        descriptionMd: "scraped narrative",
        venueName: "Auditorio",
      }),
    ]);
    const merged = mergeCanonicalGroup(groups[0]);
    expect(merged.descriptionMd).toBe("scraped narrative");
  });

  it("picks geo coordinates atomically (both-or-neither, highest priority)", () => {
    const groups = canonicalizeCandidates([
      candidate({
        source: "predicthq",
        sourceExternalId: "phq-1",
        latitude: undefined,
        longitude: undefined,
        venueName: "Auditorio",
      }),
      candidate({
        source: "ticketmaster",
        sourceExternalId: "tm-1",
        latitude: 40.441,
        longitude: -3.676,
        venueName: "Auditorio",
      }),
    ]);
    const merged = mergeCanonicalGroup(groups[0]);
    expect(merged.latitude).toBeCloseTo(40.441, 3);
    expect(merged.longitude).toBeCloseTo(-3.676, 3);
  });

  it("confidence is max across candidates", () => {
    const groups = canonicalizeCandidates([
      candidate({ source: "predicthq", sourceExternalId: "phq-1", confidence: 0.3, venueName: "Auditorio" }),
      candidate({ source: "ticketmaster", sourceExternalId: "tm-1", confidence: 0.9, venueName: "Auditorio" }),
    ]);
    const merged = mergeCanonicalGroup(groups[0]);
    expect(merged.confidence).toBeCloseTo(0.9, 2);
  });

  it("emits a warning for heuristic matches", () => {
    const groups = canonicalizeCandidates([
      candidate({
        source: "predicthq",
        sourceExternalId: "phq-1",
        title: "Concierto Orquesta Nacional",
        startsAt: new Date("2026-05-10T19:00:00.000Z"),
      }),
      candidate({
        source: "ticketmaster",
        sourceExternalId: "tm-1",
        title: "Orquesta Nacional Concierto",
        startsAt: new Date("2026-05-10T19:30:00.000Z"),
      }),
    ]);
    const merged = mergeCanonicalGroup(groups[0]);
    expect(merged.mergeWarnings.length).toBeGreaterThan(0);
    expect(merged.mergeWarnings[0]).toMatch(/heuristically/);
  });

  it("single-candidate group has no mergeWarnings and trivial primary", () => {
    const groups = canonicalizeCandidates([
      candidate({ source: "ticketmaster", sourceExternalId: "tm-1" }),
    ]);
    const merged = mergeCanonicalGroup(groups[0]);
    expect(merged.primarySource).toBe("ticketmaster");
    expect(merged.contributingSources).toEqual(["ticketmaster"]);
    expect(merged.mergeWarnings).toEqual([]);
  });
});
