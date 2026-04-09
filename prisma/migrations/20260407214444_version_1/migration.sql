-- CreateTable
CREATE TABLE "workspaces" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_memberships" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'owner',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspace_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "properties" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "property_nickname" TEXT NOT NULL,
    "property_type" TEXT,
    "room_type" TEXT,
    "country" TEXT,
    "city" TEXT,
    "region" TEXT,
    "postal_code" TEXT,
    "street_address" TEXT,
    "address_level" TEXT,
    "timezone" TEXT,
    "max_guests" INTEGER,
    "bedrooms_count" INTEGER,
    "beds_count" INTEGER,
    "bathrooms_count" INTEGER,
    "check_in_start" TEXT,
    "check_in_end" TEXT,
    "check_out_time" TEXT,
    "primary_access_method" TEXT,
    "host_contact_phone" TEXT,
    "support_contact" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "properties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wizard_sessions" (
    "id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "current_step" INTEGER NOT NULL DEFAULT 1,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wizard_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wizard_responses" (
    "id" TEXT NOT NULL,
    "wizard_session_id" TEXT NOT NULL,
    "step_number" INTEGER NOT NULL,
    "field_key" TEXT NOT NULL,
    "value_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wizard_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "spaces" (
    "id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "space_type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "guest_notes" TEXT,
    "ai_notes" TEXT,
    "internal_notes" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'public',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "spaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_amenities" (
    "id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "amenity_key" TEXT NOT NULL,
    "subtype_key" TEXT,
    "space_id" TEXT,
    "guest_instructions" TEXT,
    "ai_instructions" TEXT,
    "internal_notes" TEXT,
    "troubleshooting_notes" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'public',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "property_amenities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "troubleshooting_playbooks" (
    "id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "playbook_key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'medium',
    "symptoms_md" TEXT,
    "guest_steps_md" TEXT,
    "internal_steps_md" TEXT,
    "escalation_rule" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'public',
    "language" TEXT NOT NULL DEFAULT 'es',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "troubleshooting_playbooks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "local_places" (
    "id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "category_key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "short_note" TEXT,
    "guest_description" TEXT,
    "ai_notes" TEXT,
    "distance_meters" INTEGER,
    "hours_text" TEXT,
    "link_url" TEXT,
    "best_for" TEXT,
    "seasonal_notes" TEXT,
    "verified_at" TIMESTAMP(3),
    "visibility" TEXT NOT NULL DEFAULT 'public',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "local_places_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ops_checklist_items" (
    "id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "scope_key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "details_md" TEXT,
    "estimated_minutes" INTEGER,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ops_checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_items" (
    "id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "category_key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "restock_threshold" INTEGER,
    "location_note" TEXT,
    "unit_label" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_tasks" (
    "id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "task_type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "cadence_key" TEXT,
    "next_due_at" TIMESTAMP(3),
    "owner_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "maintenance_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_assets" (
    "id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "asset_role_key" TEXT NOT NULL,
    "media_type" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'es',
    "caption" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'public',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "uploaded_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_assignments" (
    "id" TEXT NOT NULL,
    "media_asset_id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "usage_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_sources" (
    "id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_ref" TEXT,
    "last_synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_items" (
    "id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "source_id" TEXT,
    "topic" TEXT NOT NULL,
    "body_md" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'es',
    "visibility" TEXT NOT NULL DEFAULT 'public',
    "confidence_score" DOUBLE PRECISION,
    "journey_stage" TEXT,
    "last_verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_citations" (
    "id" TEXT NOT NULL,
    "knowledge_item_id" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "quote_or_note" TEXT,
    "relevance_score" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_citations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intents" (
    "id" TEXT NOT NULL,
    "intent_key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "intents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guide_versions" (
    "id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guide_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guide_sections" (
    "id" TEXT NOT NULL,
    "guide_version_id" TEXT NOT NULL,
    "section_key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guide_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guide_section_items" (
    "id" TEXT NOT NULL,
    "guide_section_id" TEXT NOT NULL,
    "content_md" TEXT NOT NULL,
    "visibility" TEXT NOT NULL DEFAULT 'public',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guide_section_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_templates" (
    "id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "touchpoint_key" TEXT NOT NULL,
    "channel_key" TEXT,
    "subject_line" TEXT,
    "body_md" TEXT NOT NULL,
    "variables_json" JSONB,
    "language" TEXT NOT NULL DEFAULT 'es',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "message_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_automations" (
    "id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "touchpoint_key" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "channel_key" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "trigger_type" TEXT NOT NULL,
    "send_offset_minutes" INTEGER NOT NULL,
    "timezone_source" TEXT NOT NULL DEFAULT 'property_timezone',
    "conditions_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "message_automations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_drafts" (
    "id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "body_md" TEXT NOT NULL,
    "channel_key" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "message_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assistant_conversations" (
    "id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "actor_type" TEXT NOT NULL,
    "audience" TEXT NOT NULL DEFAULT 'public',
    "language" TEXT NOT NULL DEFAULT 'es',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assistant_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assistant_messages" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "citations_json" JSONB,
    "confidence_score" DOUBLE PRECISION,
    "escalated" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assistant_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "secret_references" (
    "id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "secret_type" TEXT NOT NULL,
    "vault_key" TEXT NOT NULL,
    "label" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "secret_references_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "diff_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_memberships_workspace_id_user_id_key" ON "workspace_memberships"("workspace_id", "user_id");

-- CreateIndex
CREATE INDEX "properties_workspace_id_idx" ON "properties"("workspace_id");

-- CreateIndex
CREATE INDEX "properties_status_idx" ON "properties"("status");

-- CreateIndex
CREATE INDEX "wizard_sessions_property_id_idx" ON "wizard_sessions"("property_id");

-- CreateIndex
CREATE INDEX "wizard_responses_wizard_session_id_idx" ON "wizard_responses"("wizard_session_id");

-- CreateIndex
CREATE INDEX "spaces_property_id_idx" ON "spaces"("property_id");

-- CreateIndex
CREATE INDEX "spaces_property_id_visibility_idx" ON "spaces"("property_id", "visibility");

-- CreateIndex
CREATE INDEX "property_amenities_property_id_idx" ON "property_amenities"("property_id");

-- CreateIndex
CREATE INDEX "property_amenities_property_id_amenity_key_idx" ON "property_amenities"("property_id", "amenity_key");

-- CreateIndex
CREATE INDEX "troubleshooting_playbooks_property_id_idx" ON "troubleshooting_playbooks"("property_id");

-- CreateIndex
CREATE INDEX "troubleshooting_playbooks_property_id_playbook_key_idx" ON "troubleshooting_playbooks"("property_id", "playbook_key");

-- CreateIndex
CREATE INDEX "local_places_property_id_idx" ON "local_places"("property_id");

-- CreateIndex
CREATE INDEX "local_places_property_id_category_key_idx" ON "local_places"("property_id", "category_key");

-- CreateIndex
CREATE INDEX "ops_checklist_items_property_id_idx" ON "ops_checklist_items"("property_id");

-- CreateIndex
CREATE INDEX "stock_items_property_id_idx" ON "stock_items"("property_id");

-- CreateIndex
CREATE INDEX "maintenance_tasks_property_id_idx" ON "maintenance_tasks"("property_id");

-- CreateIndex
CREATE INDEX "maintenance_tasks_next_due_at_idx" ON "maintenance_tasks"("next_due_at");

-- CreateIndex
CREATE INDEX "media_assets_property_id_idx" ON "media_assets"("property_id");

-- CreateIndex
CREATE INDEX "media_assets_property_id_visibility_status_idx" ON "media_assets"("property_id", "visibility", "status");

-- CreateIndex
CREATE INDEX "media_assignments_entity_type_entity_id_idx" ON "media_assignments"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "knowledge_sources_property_id_idx" ON "knowledge_sources"("property_id");

-- CreateIndex
CREATE INDEX "knowledge_items_property_id_idx" ON "knowledge_items"("property_id");

-- CreateIndex
CREATE INDEX "knowledge_items_property_id_visibility_language_idx" ON "knowledge_items"("property_id", "visibility", "language");

-- CreateIndex
CREATE INDEX "knowledge_items_property_id_journey_stage_idx" ON "knowledge_items"("property_id", "journey_stage");

-- CreateIndex
CREATE INDEX "knowledge_citations_knowledge_item_id_idx" ON "knowledge_citations"("knowledge_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "intents_intent_key_key" ON "intents"("intent_key");

-- CreateIndex
CREATE INDEX "guide_versions_property_id_idx" ON "guide_versions"("property_id");

-- CreateIndex
CREATE INDEX "guide_versions_property_id_status_idx" ON "guide_versions"("property_id", "status");

-- CreateIndex
CREATE INDEX "guide_sections_guide_version_id_idx" ON "guide_sections"("guide_version_id");

-- CreateIndex
CREATE INDEX "guide_section_items_guide_section_id_idx" ON "guide_section_items"("guide_section_id");

-- CreateIndex
CREATE INDEX "message_templates_property_id_idx" ON "message_templates"("property_id");

-- CreateIndex
CREATE INDEX "message_templates_property_id_touchpoint_key_idx" ON "message_templates"("property_id", "touchpoint_key");

-- CreateIndex
CREATE INDEX "message_automations_property_id_idx" ON "message_automations"("property_id");

-- CreateIndex
CREATE INDEX "message_automations_property_id_touchpoint_key_idx" ON "message_automations"("property_id", "touchpoint_key");

-- CreateIndex
CREATE INDEX "message_drafts_property_id_idx" ON "message_drafts"("property_id");

-- CreateIndex
CREATE INDEX "assistant_conversations_property_id_idx" ON "assistant_conversations"("property_id");

-- CreateIndex
CREATE INDEX "assistant_messages_conversation_id_idx" ON "assistant_messages"("conversation_id");

-- CreateIndex
CREATE INDEX "secret_references_property_id_idx" ON "secret_references"("property_id");

-- CreateIndex
CREATE INDEX "audit_logs_property_id_idx" ON "audit_logs"("property_id");

-- CreateIndex
CREATE INDEX "audit_logs_property_id_entity_type_idx" ON "audit_logs"("property_id", "entity_type");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- AddForeignKey
ALTER TABLE "workspace_memberships" ADD CONSTRAINT "workspace_memberships_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_memberships" ADD CONSTRAINT "workspace_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wizard_sessions" ADD CONSTRAINT "wizard_sessions_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wizard_responses" ADD CONSTRAINT "wizard_responses_wizard_session_id_fkey" FOREIGN KEY ("wizard_session_id") REFERENCES "wizard_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spaces" ADD CONSTRAINT "spaces_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_amenities" ADD CONSTRAINT "property_amenities_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "troubleshooting_playbooks" ADD CONSTRAINT "troubleshooting_playbooks_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "local_places" ADD CONSTRAINT "local_places_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ops_checklist_items" ADD CONSTRAINT "ops_checklist_items_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_items" ADD CONSTRAINT "stock_items_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_tasks" ADD CONSTRAINT "maintenance_tasks_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_uploaded_by_user_id_fkey" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_assignments" ADD CONSTRAINT "media_assignments_media_asset_id_fkey" FOREIGN KEY ("media_asset_id") REFERENCES "media_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_sources" ADD CONSTRAINT "knowledge_sources_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_items" ADD CONSTRAINT "knowledge_items_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_items" ADD CONSTRAINT "knowledge_items_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "knowledge_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

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
ALTER TABLE "message_drafts" ADD CONSTRAINT "message_drafts_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assistant_conversations" ADD CONSTRAINT "assistant_conversations_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assistant_messages" ADD CONSTRAINT "assistant_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "assistant_conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "secret_references" ADD CONSTRAINT "secret_references_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
