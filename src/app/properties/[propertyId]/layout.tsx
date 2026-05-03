import { AppShell } from "@/components/layout/app-shell";
import { loadOwnedProperty } from "@/lib/auth/owned-property";
import { handleOwnershipPageError } from "@/lib/auth/page-helpers";
import { prisma } from "@/lib/db";

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
  let operator;
  try {
    ({ property, operator } = await loadOwnedProperty(propertyId));
  } catch (err) {
    handleOwnershipPageError(err);
  }

  const workspaceProperties = await prisma.property.findMany({
    where: { workspaceId: operator.workspaceId, status: { not: "archived" } },
    orderBy: { propertyNickname: "asc" },
    select: {
      id: true,
      propertyNickname: true,
      city: true,
      country: true,
    },
  });

  return (
    <AppShell
      propertyId={propertyId}
      propertyNickname={property.propertyNickname}
      publicSlug={property.publicSlug}
      workspaceProperties={workspaceProperties}
    >
      {children}
    </AppShell>
  );
}
