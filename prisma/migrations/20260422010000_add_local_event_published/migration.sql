-- Rama 13C (curation): host-gated publication of synced events.
-- Events sit in local_events as candidates after sync; only rows with
-- published = true surface in the public guide (both map pins and the
-- "upcoming events" listing).

ALTER TABLE "local_events"
  ADD COLUMN "published" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "local_events_property_id_published_idx"
  ON "local_events" ("property_id", "published");
