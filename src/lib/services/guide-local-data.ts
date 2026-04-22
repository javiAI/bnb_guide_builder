/**
 * Shared, request-scoped fetchers for the `gs.local` section of the guest
 * guide. Both the existing resolver (`resolveLocal` in
 * `guide-rendering.service.ts`) and the new map/events builders call
 * these, so a single page render makes one query per table even though
 * two subsystems consume the data.
 *
 * `React.cache` deduplicates across Server Components within the same
 * request — works for our `/g/[slug]/page.tsx` flow where `composeGuide`
 * and `buildGuideMapData` / `buildGuideLocalEventsData` are invoked from
 * the same render.
 */

import { cache } from "react";
import { prisma } from "@/lib/db";

export const getLocalPlacesForProperty = cache(
  async (propertyId: string) =>
    prisma.localPlace.findMany({
      where: { propertyId },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      select: {
        id: true,
        categoryKey: true,
        name: true,
        guestDescription: true,
        aiNotes: true,
        distanceMeters: true,
        hoursText: true,
        latitude: true,
        longitude: true,
        visibility: true,
      },
    }),
);

export type LocalPlaceForGuide = Awaited<
  ReturnType<typeof getLocalPlacesForProperty>
>[number];

export const getLocalEventsForProperty = cache(
  async (propertyId: string) =>
    prisma.localEvent.findMany({
      // Guest-facing fetcher. `published: true` is the host curation gate —
      // events enter the DB unpublished after sync and only surface here once
      // the host opts in on the admin page. The `(propertyId, published)`
      // composite index keeps this cheap even when thousands of unpublished
      // candidates exist.
      where: { propertyId, published: true },
      orderBy: [{ startsAt: "asc" }],
      select: {
        id: true,
        title: true,
        descriptionMd: true,
        categoryKey: true,
        startsAt: true,
        endsAt: true,
        venueName: true,
        latitude: true,
        longitude: true,
        sourceUrl: true,
        primarySource: true,
        contributingSources: true,
      },
    }),
);

export type LocalEventForGuide = Awaited<
  ReturnType<typeof getLocalEventsForProperty>
>[number];

/** Admin-only fetcher: returns ALL events (published + unpublished) with the
 * `published` flag so the host's local-guide page can render both and toggle. */
export async function getLocalEventsForPropertyAdmin(propertyId: string) {
  return prisma.localEvent.findMany({
    where: { propertyId },
    orderBy: [{ startsAt: "asc" }],
    select: {
      id: true,
      title: true,
      descriptionMd: true,
      categoryKey: true,
      startsAt: true,
      endsAt: true,
      venueName: true,
      venueAddress: true,
      latitude: true,
      longitude: true,
      sourceUrl: true,
      primarySource: true,
      contributingSources: true,
      published: true,
      lastSyncedAt: true,
    },
  });
}

export type LocalEventForAdmin = Awaited<
  ReturnType<typeof getLocalEventsForPropertyAdmin>
>[number];
