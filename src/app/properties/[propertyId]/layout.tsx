import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { AppShell } from "@/components/layout/app-shell";

interface WorkspaceLayoutProps {
  children: React.ReactNode;
  params: Promise<{ propertyId: string }>;
}

export default async function WorkspaceLayout({
  children,
  params,
}: WorkspaceLayoutProps) {
  const { propertyId } = await params;

  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { propertyNickname: true },
  });

  if (!property) notFound();

  return (
    <AppShell propertyId={propertyId} propertyNickname={property.propertyNickname}>
      {children}
    </AppShell>
  );
}
