/*
  Warnings:

  - A unique constraint covering the columns `[workspace_id,property_nickname]` on the table `properties` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "assistant_conversations" DROP CONSTRAINT "assistant_conversations_property_id_fkey";

-- DropForeignKey
ALTER TABLE "assistant_messages" DROP CONSTRAINT "assistant_messages_conversation_id_fkey";

-- DropForeignKey
ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_property_id_fkey";

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
ALTER TABLE "local_places" DROP CONSTRAINT "local_places_property_id_fkey";

-- DropForeignKey
ALTER TABLE "maintenance_tasks" DROP CONSTRAINT "maintenance_tasks_property_id_fkey";

-- DropForeignKey
ALTER TABLE "media_assets" DROP CONSTRAINT "media_assets_property_id_fkey";

-- DropForeignKey
ALTER TABLE "media_assignments" DROP CONSTRAINT "media_assignments_media_asset_id_fkey";

-- DropForeignKey
ALTER TABLE "message_automations" DROP CONSTRAINT "message_automations_property_id_fkey";

-- DropForeignKey
ALTER TABLE "message_automations" DROP CONSTRAINT "message_automations_template_id_fkey";

-- DropForeignKey
ALTER TABLE "message_drafts" DROP CONSTRAINT "message_drafts_property_id_fkey";

-- DropForeignKey
ALTER TABLE "message_templates" DROP CONSTRAINT "message_templates_property_id_fkey";

-- DropForeignKey
ALTER TABLE "ops_checklist_items" DROP CONSTRAINT "ops_checklist_items_property_id_fkey";

-- DropForeignKey
ALTER TABLE "property_amenities" DROP CONSTRAINT "property_amenities_property_id_fkey";

-- DropForeignKey
ALTER TABLE "secret_references" DROP CONSTRAINT "secret_references_property_id_fkey";

-- DropForeignKey
ALTER TABLE "spaces" DROP CONSTRAINT "spaces_property_id_fkey";

-- DropForeignKey
ALTER TABLE "stock_items" DROP CONSTRAINT "stock_items_property_id_fkey";

-- DropForeignKey
ALTER TABLE "troubleshooting_playbooks" DROP CONSTRAINT "troubleshooting_playbooks_property_id_fkey";

-- DropForeignKey
ALTER TABLE "wizard_responses" DROP CONSTRAINT "wizard_responses_wizard_session_id_fkey";

-- DropForeignKey
ALTER TABLE "wizard_sessions" DROP CONSTRAINT "wizard_sessions_property_id_fkey";

-- CreateIndex
CREATE UNIQUE INDEX "properties_workspace_id_property_nickname_key" ON "properties"("workspace_id", "property_nickname");

-- AddForeignKey
ALTER TABLE "wizard_sessions" ADD CONSTRAINT "wizard_sessions_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wizard_responses" ADD CONSTRAINT "wizard_responses_wizard_session_id_fkey" FOREIGN KEY ("wizard_session_id") REFERENCES "wizard_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spaces" ADD CONSTRAINT "spaces_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_amenities" ADD CONSTRAINT "property_amenities_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "troubleshooting_playbooks" ADD CONSTRAINT "troubleshooting_playbooks_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "local_places" ADD CONSTRAINT "local_places_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ops_checklist_items" ADD CONSTRAINT "ops_checklist_items_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_items" ADD CONSTRAINT "stock_items_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_tasks" ADD CONSTRAINT "maintenance_tasks_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_assignments" ADD CONSTRAINT "media_assignments_media_asset_id_fkey" FOREIGN KEY ("media_asset_id") REFERENCES "media_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_sources" ADD CONSTRAINT "knowledge_sources_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_items" ADD CONSTRAINT "knowledge_items_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_citations" ADD CONSTRAINT "knowledge_citations_knowledge_item_id_fkey" FOREIGN KEY ("knowledge_item_id") REFERENCES "knowledge_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_citations" ADD CONSTRAINT "knowledge_citations_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "knowledge_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guide_versions" ADD CONSTRAINT "guide_versions_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guide_sections" ADD CONSTRAINT "guide_sections_guide_version_id_fkey" FOREIGN KEY ("guide_version_id") REFERENCES "guide_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guide_section_items" ADD CONSTRAINT "guide_section_items_guide_section_id_fkey" FOREIGN KEY ("guide_section_id") REFERENCES "guide_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_templates" ADD CONSTRAINT "message_templates_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_automations" ADD CONSTRAINT "message_automations_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_automations" ADD CONSTRAINT "message_automations_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "message_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_drafts" ADD CONSTRAINT "message_drafts_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assistant_conversations" ADD CONSTRAINT "assistant_conversations_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assistant_messages" ADD CONSTRAINT "assistant_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "assistant_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "secret_references" ADD CONSTRAINT "secret_references_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
