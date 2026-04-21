import { Prisma } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/db";
import type { AggregatedLocalEventsResult } from "./aggregator";

// ── Sync service ──
// Persists the aggregator output to `local_events` + `local_event_source_links`.
//
// Contract:
//   - Idempotent: running the same tick twice produces the same DB state.
//   - Transactional: the whole sync for a property runs inside one
//     `prisma.$transaction` callback. Either both tables reflect the tick,
//     or neither does.
//   - Reconciling:
//       · New canonical groups are created.
//       · Existing groups (matched by `(propertyId, canonicalKey)`) are
//         updated and `lastSyncedAt` is bumped to `tickStartedAt`.
//       · Per-event links are reconciled — sources that dropped off this
//         tick have their link rows deleted; surviving sources are upserted
//         with fresh fields.
//       · Future canonical rows that weren't surfaced this tick (i.e.
//         `lastSyncedAt < tickStartedAt AND startsAt >= tickStartedAt`) are
//         deleted so stale forward-looking events don't linger. Past events
//         remain until a separate retention sweep (out of scope for 13B).
//
// Count semantics for the returned report: created/updated are measured by
// pre-loading existing canonical keys / link keys before the writes — a row
// that existed before the tick is an update, otherwise a create. Deletes are
// observed via `deleteMany.count`.

export interface SyncLocalEventsInput {
  propertyId: string;
  aggregated: AggregatedLocalEventsResult;
  tickStartedAt: Date;
  prisma?: typeof defaultPrisma;
}

export interface SyncLocalEventsReport {
  eventsCreated: number;
  eventsUpdated: number;
  eventsDeleted: number;
  linksCreated: number;
  linksUpdated: number;
  linksDeleted: number;
}

export async function syncLocalEventsForProperty(
  input: SyncLocalEventsInput,
): Promise<SyncLocalEventsReport> {
  const { propertyId, aggregated, tickStartedAt } = input;
  const prisma = input.prisma ?? defaultPrisma;

  if (aggregated.merged.length !== aggregated.groups.length) {
    throw new Error(
      `aggregated.merged and aggregated.groups must be aligned 1:1 (got ${aggregated.merged.length} merged, ${aggregated.groups.length} groups)`,
    );
  }

  let eventsCreated = 0;
  let eventsUpdated = 0;
  let linksCreated = 0;
  let linksUpdated = 0;
  let eventsDeleted = 0;
  let linksDeleted = 0;

  await prisma.$transaction(async (tx) => {
    const existingEvents = await tx.localEvent.findMany({
      where: { propertyId },
      select: { id: true, canonicalKey: true },
    });
    const existingByCanonicalKey = new Map(
      existingEvents.map((e) => [e.canonicalKey, e.id]),
    );

    const existingLinks = await tx.localEventSourceLink.findMany({
      where: { propertyId },
      select: {
        id: true,
        eventId: true,
        source: true,
        sourceExternalId: true,
      },
    });
    const existingLinkBySourceKey = new Map<
      string,
      { id: string; eventId: string }
    >();
    const existingLinksByEventId = new Map<
      string,
      Array<{ id: string; source: string; sourceExternalId: string }>
    >();
    for (const l of existingLinks) {
      existingLinkBySourceKey.set(`${l.source}|${l.sourceExternalId}`, {
        id: l.id,
        eventId: l.eventId,
      });
      const bucket = existingLinksByEventId.get(l.eventId);
      const entry = { id: l.id, source: l.source, sourceExternalId: l.sourceExternalId };
      if (bucket) bucket.push(entry);
      else existingLinksByEventId.set(l.eventId, [entry]);
    }

    for (let i = 0; i < aggregated.merged.length; i++) {
      const m = aggregated.merged[i];
      const group = aggregated.groups[i];

      const existed = existingByCanonicalKey.has(m.canonicalKey);

      const priceInfoForDb: Prisma.InputJsonValue | typeof Prisma.JsonNull =
        m.priceInfo ? (m.priceInfo as Prisma.InputJsonValue) : Prisma.JsonNull;

      const upserted = await tx.localEvent.upsert({
        where: {
          propertyId_canonicalKey: {
            propertyId,
            canonicalKey: m.canonicalKey,
          },
        },
        create: {
          propertyId,
          canonicalKey: m.canonicalKey,
          title: m.title,
          descriptionMd: m.descriptionMd ?? null,
          categoryKey: m.categoryKey,
          startsAt: m.startsAt,
          endsAt: m.endsAt ?? null,
          venueName: m.venueName ?? null,
          venueAddress: m.venueAddress ?? null,
          latitude: m.latitude ?? null,
          longitude: m.longitude ?? null,
          imageUrl: m.imageUrl ?? null,
          sourceUrl: m.sourceUrl,
          priceInfo: priceInfoForDb,
          confidence: m.confidence,
          primarySource: m.primarySource,
          contributingSources: m.contributingSources,
          mergeWarnings: m.mergeWarnings,
          lastSyncedAt: tickStartedAt,
        },
        update: {
          title: m.title,
          descriptionMd: m.descriptionMd ?? null,
          categoryKey: m.categoryKey,
          startsAt: m.startsAt,
          endsAt: m.endsAt ?? null,
          venueName: m.venueName ?? null,
          venueAddress: m.venueAddress ?? null,
          latitude: m.latitude ?? null,
          longitude: m.longitude ?? null,
          imageUrl: m.imageUrl ?? null,
          sourceUrl: m.sourceUrl,
          priceInfo: priceInfoForDb,
          confidence: m.confidence,
          primarySource: m.primarySource,
          contributingSources: m.contributingSources,
          mergeWarnings: m.mergeWarnings,
          lastSyncedAt: tickStartedAt,
        },
      });

      if (existed) eventsUpdated += 1;
      else eventsCreated += 1;

      const tickLinkKeys = new Set<string>();
      for (const c of group.candidates) {
        const key = `${c.source}|${c.sourceExternalId}`;
        tickLinkKeys.add(key);

        const existingLink = existingLinkBySourceKey.get(key);

        await tx.localEventSourceLink.upsert({
          where: {
            propertyId_source_sourceExternalId: {
              propertyId,
              source: c.source,
              sourceExternalId: c.sourceExternalId,
            },
          },
          create: {
            eventId: upserted.id,
            propertyId,
            source: c.source,
            sourceExternalId: c.sourceExternalId,
            sourceUrl: c.sourceUrl,
            confidence: c.confidence,
            providerMetadata:
              c.providerMetadata as unknown as Prisma.InputJsonValue,
            retrievedAt: new Date(c.retrievedAt),
          },
          update: {
            eventId: upserted.id,
            sourceUrl: c.sourceUrl,
            confidence: c.confidence,
            providerMetadata:
              c.providerMetadata as unknown as Prisma.InputJsonValue,
            retrievedAt: new Date(c.retrievedAt),
          },
        });

        if (existingLink) linksUpdated += 1;
        else linksCreated += 1;
      }

      const linksForEvent = existingLinksByEventId.get(upserted.id) ?? [];
      const staleLinkIds: string[] = [];
      for (const l of linksForEvent) {
        const key = `${l.source}|${l.sourceExternalId}`;
        if (!tickLinkKeys.has(key)) staleLinkIds.push(l.id);
      }
      if (staleLinkIds.length > 0) {
        const { count } = await tx.localEventSourceLink.deleteMany({
          where: { id: { in: staleLinkIds } },
        });
        linksDeleted += count;
      }
    }

    const { count: deletedEventCount } = await tx.localEvent.deleteMany({
      where: {
        propertyId,
        lastSyncedAt: { lt: tickStartedAt },
        startsAt: { gte: tickStartedAt },
      },
    });
    eventsDeleted = deletedEventCount;
    // Links for deleted events cascade via FK `onDelete: Cascade`.
  });

  return {
    eventsCreated,
    eventsUpdated,
    eventsDeleted,
    linksCreated,
    linksUpdated,
    linksDeleted,
  };
}
