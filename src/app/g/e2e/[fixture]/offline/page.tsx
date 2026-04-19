import { notFound } from "next/navigation";
import { GuideOfflineContent } from "@/components/public-guide/guide-offline-content";

export const dynamic = "force-dynamic";

export default function GuideE2EOfflinePage() {
  if (process.env.E2E !== "1") notFound();
  return <GuideOfflineContent />;
}
