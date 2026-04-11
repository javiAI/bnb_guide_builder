import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { ContactsForm } from "./contacts-form";

interface Props {
  params: Promise<{ propertyId: string }>;
}

export default async function ContactsPage({ params }: Props) {
  const { propertyId } = await params;

  const [property, contacts] = await Promise.all([
    prisma.property.findUnique({ where: { id: propertyId }, select: { id: true } }),
    prisma.contact.findMany({
      where: { propertyId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  if (!property) redirect("/");

  return <ContactsForm propertyId={propertyId} contacts={contacts} />;
}
