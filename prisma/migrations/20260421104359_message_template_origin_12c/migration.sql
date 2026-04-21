-- Rama 12C: track provenance of MessageTemplate rows so applyPack() can merge
-- by (propertyId, origin, packId) without clobbering host edits. Existing rows
-- default to origin='user' — pre-12C templates are user-owned and never touched
-- by a pack re-apply.

-- AlterTable
ALTER TABLE "message_templates" ADD COLUMN     "origin" TEXT NOT NULL DEFAULT 'user',
ADD COLUMN     "pack_id" TEXT;

-- CreateIndex
CREATE INDEX "message_templates_property_id_origin_pack_id_idx" ON "message_templates"("property_id", "origin", "pack_id");
