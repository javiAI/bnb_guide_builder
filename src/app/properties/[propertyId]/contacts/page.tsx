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
      select: {
        id: true,
        roleKey: true,
        entityType: true,
        displayName: true,
        contactPersonName: true,
        phone: true,
        phoneSecondary: true,
        email: true,
        whatsapp: true,
        address: true,
        availabilitySchedule: true,
        emergencyAvailable: true,
        hasPropertyAccess: true,
        internalNotes: true,
        guestVisibleNotes: true,
        visibility: true,
        isPrimary: true,
        sortOrder: true,
      },
    }),
  ]);

  if (!property) redirect("/");

  return <ContactsForm propertyId={propertyId} contacts={contacts} />;
}
