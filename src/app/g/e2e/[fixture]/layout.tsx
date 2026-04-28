import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ServiceWorkerRegister } from "@/lib/client/service-worker-register";
import { InstallNudge } from "@/components/public-guide/install-nudge";
import { getBrandPair } from "@/config/brand-palette";

interface Props {
  params: Promise<{ fixture: string }>;
  children: React.ReactNode;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  if (process.env.E2E !== "1") notFound();
  const { fixture } = await params;
  return {
    manifest: `/g/e2e/${fixture}/manifest.webmanifest`,
    robots: { index: false, follow: false },
  };
}

export default async function PublicGuideE2ELayout({ params, children }: Props) {
  if (process.env.E2E !== "1") notFound();
  const { fixture } = await params;
  const slug = `e2e/${fixture}`;
  const { light: brandLight, dark: brandDark } = getBrandPair(null);
  return (
    <>
      {children}
      <ServiceWorkerRegister slug={slug} />
      <InstallNudge slug={slug} brandLight={brandLight} brandDark={brandDark} />
    </>
  );
}
