import type { Metadata } from "next";
import { ServiceWorkerRegister } from "@/lib/client/service-worker-register";
import { InstallNudge } from "@/components/public-guide/install-nudge";

interface Props {
  params: Promise<{ slug: string }>;
  children: React.ReactNode;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return {
    manifest: `/g/${slug}/manifest.webmanifest`,
  };
}

export default async function PublicGuideLayout({ params, children }: Props) {
  const { slug } = await params;
  return (
    <>
      {children}
      <ServiceWorkerRegister slug={slug} />
      <InstallNudge slug={slug} />
    </>
  );
}
