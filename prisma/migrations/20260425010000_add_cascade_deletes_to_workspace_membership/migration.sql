-- Add ON DELETE CASCADE to workspace_membership foreign keys
ALTER TABLE "workspace_memberships" DROP CONSTRAINT "workspace_memberships_workspace_id_fkey";
ALTER TABLE "workspace_memberships" DROP CONSTRAINT "workspace_memberships_user_id_fkey";

ALTER TABLE "workspace_memberships"
ADD CONSTRAINT "workspace_memberships_workspace_id_fkey"
FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "workspace_memberships"
ADD CONSTRAINT "workspace_memberships_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
