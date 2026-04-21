-- Messaging automations (Rama 12B).
--
-- Introduces the `Reservation` model and expands `MessageDraft` with the
-- lifecycle/scheduling columns the engine materializes into. The legacy
-- `status` default (`draft`) becomes `pending_review`; a backfill update
-- migrates any pre-12B rows so they participate in the new lifecycle.

-- AlterTable
ALTER TABLE "message_drafts" ADD COLUMN     "automation_id" TEXT,
ADD COLUMN     "lifecycle_history_json" JSONB,
ADD COLUMN     "reservation_id" TEXT,
ADD COLUMN     "resolution_states_json" JSONB,
ADD COLUMN     "scheduled_send_at" TIMESTAMP(3),
ADD COLUMN     "template_id" TEXT,
ADD COLUMN     "touchpoint_key" TEXT,
ALTER COLUMN "status" SET DEFAULT 'pending_review';

-- Backfill: any pre-12B rows with the previous free-form default get mapped
-- to the new lifecycle's initial state so they are reachable by the UI and
-- the `LIFECYCLE_TRANSITIONS` map.
UPDATE "message_drafts" SET "status" = 'pending_review' WHERE "status" = 'draft';

-- CreateTable
CREATE TABLE "reservations" (
    "id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "external_id" TEXT,
    "guest_name" TEXT NOT NULL,
    "check_in_date" DATE NOT NULL,
    "check_out_date" DATE NOT NULL,
    "num_guests" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'confirmed',
    "locale" TEXT,
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reservations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reservations_property_id_check_in_date_idx" ON "reservations"("property_id", "check_in_date");

-- CreateIndex
CREATE INDEX "reservations_property_id_status_idx" ON "reservations"("property_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "reservations_property_id_source_external_id_key" ON "reservations"("property_id", "source", "external_id");

-- CreateIndex
CREATE INDEX "message_drafts_property_id_status_idx" ON "message_drafts"("property_id", "status");

-- CreateIndex
CREATE INDEX "message_drafts_status_scheduled_send_at_idx" ON "message_drafts"("status", "scheduled_send_at");

-- CreateIndex
CREATE UNIQUE INDEX "message_drafts_automation_id_reservation_id_key" ON "message_drafts"("automation_id", "reservation_id");

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_drafts" ADD CONSTRAINT "message_drafts_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_drafts" ADD CONSTRAINT "message_drafts_automation_id_fkey" FOREIGN KEY ("automation_id") REFERENCES "message_automations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
