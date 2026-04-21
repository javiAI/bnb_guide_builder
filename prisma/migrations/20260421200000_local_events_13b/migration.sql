-- CreateTable
CREATE TABLE "local_events" (
    "id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "canonical_key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description_md" TEXT,
    "category_key" TEXT NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3),
    "venue_name" TEXT,
    "venue_address" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "image_url" TEXT,
    "source_url" TEXT NOT NULL,
    "price_info" JSONB,
    "confidence" DOUBLE PRECISION NOT NULL,
    "primary_source" TEXT NOT NULL,
    "contributing_sources" TEXT[],
    "merge_warnings" TEXT[],
    "last_synced_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "local_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "local_event_source_links" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "source_external_id" TEXT NOT NULL,
    "source_url" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "provider_metadata" JSONB NOT NULL,
    "retrieved_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "local_event_source_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "local_events_property_id_starts_at_idx" ON "local_events"("property_id", "starts_at");

-- CreateIndex
CREATE INDEX "local_events_property_id_category_key_idx" ON "local_events"("property_id", "category_key");

-- CreateIndex
CREATE UNIQUE INDEX "local_events_property_canonical_unique" ON "local_events"("property_id", "canonical_key");

-- CreateIndex
CREATE INDEX "local_event_source_links_event_id_idx" ON "local_event_source_links"("event_id");

-- CreateIndex
CREATE INDEX "local_event_source_links_property_id_idx" ON "local_event_source_links"("property_id");

-- CreateIndex
CREATE UNIQUE INDEX "local_event_source_links_property_source_ext_unique" ON "local_event_source_links"("property_id", "source", "source_external_id");

-- AddForeignKey
ALTER TABLE "local_events" ADD CONSTRAINT "local_events_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "local_event_source_links" ADD CONSTRAINT "local_event_source_links_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "local_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
