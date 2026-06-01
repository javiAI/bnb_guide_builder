import { redirect } from "next/navigation";

/**
 * Knowledge moved into the unified Asistente IA page (Liora 16F.5). This route
 * is kept (deep links / `hideFromNav` section editor) and redirects to `/ai`,
 * preserving the locale query.
 */
export default async function KnowledgePage({
  params,
  searchParams,
}: {
  params: Promise<{ propertyId: string }>;
  searchParams: Promise<{ locale?: string }>;
}) {
  const { propertyId } = await params;
  const { locale } = await searchParams;
  const qs = locale ? `?locale=${encodeURIComponent(locale)}` : "";
  redirect(`/properties/${propertyId}/ai${qs}`);
}
