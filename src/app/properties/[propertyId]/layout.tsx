import { AppShell } from "@/components/layout/app-shell";
import { loadOwnedProperty } from "@/lib/auth/owned-property";
import { handleOwnershipPageError } from "@/lib/auth/page-helpers";

interface WorkspaceLayoutProps {
  children: React.ReactNode;
  params: Promise<{ propertyId: string }>;
}

export default async function WorkspaceLayout({
  children,
  params,
}: WorkspaceLayoutProps) {
  const { propertyId } = await params;

  let property;
  try {
    ({ property } = await loadOwnedProperty(propertyId));
  } catch (err) {
    handleOwnershipPageError(err);
  }

  return (
    <AppShell propertyId={propertyId} propertyNickname={property.propertyNickname}>
      {children}
    </AppShell>
  );
}
