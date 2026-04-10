/*
  Warnings:

  - Added the required column `workspace_id` to the `wizard_sessions` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "assistant_conversations" DROP CONSTRAINT "assistant_conversations_property_id_fkey";

-- DropForeignKey
ALTER TABLE "assistant_messages" DROP CONSTRAINT "assistant_messages_conversation_id_fkey";

-- DropForeignKey
ALTER TABLE "guide_section_items" DROP CONSTRAINT "guide_section_items_guide_section_id_fkey";

-- DropForeignKey
ALTER TABLE "guide_sections" DROP CONSTRAINT "guide_sections_guide_version_id_fkey";

-- DropForeignKey
ALTER TABLE "guide_versions" DROP CONSTRAINT "guide_versions_property_id_fkey";

-- DropForeignKey
ALTER TABLE "knowledge_citations" DROP CONSTRAINT "knowledge_citations_knowledge_item_id_fkey";

-- DropForeignKey
ALTER TABLE "knowledge_citations" DROP CONSTRAINT "knowledge_citations_source_id_fkey";

-- DropForeignKey
ALTER TABLE "knowledge_items" DROP CONSTRAINT "knowledge_items_property_id_fkey";

-- DropForeignKey
ALTER TABLE "knowledge_sources" DROP CONSTRAINT "knowledge_sources_property_id_fkey";

-- DropForeignKey
ALTER TABLE "media_assets" DROP CONSTRAINT "media_assets_property_id_fkey";

-- DropForeignKey
ALTER TABLE "media_assignments" DROP CONSTRAINT "media_assignments_media_asset_id_fkey";

-- DropForeignKey
ALTER TABLE "message_automations" DROP CONSTRAINT "message_automations_property_id_fkey";

-- DropForeignKey
ALTER TABLE "message_automations" DROP CONSTRAINT "message_automations_template_id_fkey";

-- DropForeignKey
ALTER TABLE "message_templates" DROP CONSTRAINT "message_templates_property_id_fkey";

-- AlterTable
ALTER TABLE "properties" ADD COLUMN     "access_methods_json" JSONB,
ADD COLUMN     "children_age_limit" INTEGER NOT NULL DEFAULT 14,
ADD COLUMN     "custom_access_method_desc" TEXT,
ADD COLUMN     "custom_access_method_label" TEXT,
ADD COLUMN     "custom_property_type_desc" TEXT,
ADD COLUMN     "custom_property_type_label" TEXT,
ADD COLUMN     "custom_room_type_desc" TEXT,
ADD COLUMN     "custom_room_type_label" TEXT,
ADD COLUMN     "max_adults" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "max_children" INTEGER NOT NULL DEFAULT 0;

-- AlterTable: wizard_sessions - add nullable first, backfill, then enforce NOT NULL
ALTER TABLE "wizard_sessions" ADD COLUMN     "property_nickname" TEXT,
ADD COLUMN     "state_json" JSONB,
ADD COLUMN     "workspace_id" TEXT,
ALTER COLUMN "property_id" DROP NOT NULL;

-- Backfill workspace_id from the linked property
UPDATE "wizard_sessions" ws
SET "workspace_id" = p."workspace_id"
FROM "properties" p
WHERE ws."property_id" = p."id"
  AND ws."workspace_id" IS NULL;

-- Delete orphaned sessions with no property (shouldn't exist, but safety)
DELETE FROM "wizard_sessions" WHERE "workspace_id" IS NULL;

-- Now enforce NOT NULL
ALTER TABLE "wizard_sessions" ALTER COLUMN "workspace_id" SET NOT NULL;

-- CreateTable
CREATE TABLE "bed_configurations" (
    "id" TEXT NOT NULL,
    "space_id" TEXT NOT NULL,
    "bed_type" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bed_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bed_configurations_space_id_idx" ON "bed_configurations"("space_id");

-- CreateIndex
CREATE INDEX "wizard_sessions_workspace_id_idx" ON "wizard_sessions"("workspace_id");

-- AddForeignKey
ALTER TABLE "wizard_sessions" ADD CONSTRAINT "wizard_sessions_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bed_configurations" ADD CONSTRAINT "bed_configurations_space_id_fkey" FOREIGN KEY ("space_id") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_assignments" ADD CONSTRAINT "media_assignments_media_asset_id_fkey" FOREIGN KEY ("media_asset_id") REFERENCES "media_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_sources" ADD CONSTRAINT "knowledge_sources_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_items" ADD CONSTRAINT "knowledge_items_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_citations" ADD CONSTRAINT "knowledge_citations_knowledge_item_id_fkey" FOREIGN KEY ("knowledge_item_id") REFERENCES "knowledge_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_citations" ADD CONSTRAINT "knowledge_citations_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "knowledge_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guide_versions" ADD CONSTRAINT "guide_versions_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guide_sections" ADD CONSTRAINT "guide_sections_guide_version_id_fkey" FOREIGN KEY ("guide_version_id") REFERENCES "guide_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guide_section_items" ADD CONSTRAINT "guide_section_items_guide_section_id_fkey" FOREIGN KEY ("guide_section_id") REFERENCES "guide_sections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_templates" ADD CONSTRAINT "message_templates_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_automations" ADD CONSTRAINT "message_automations_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_automations" ADD CONSTRAINT "message_automations_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "message_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assistant_conversations" ADD CONSTRAINT "assistant_conversations_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assistant_messages" ADD CONSTRAINT "assistant_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "assistant_conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
