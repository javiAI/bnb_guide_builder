import { cache } from "react";
import { headers } from "next/headers";
import QRCode from "qrcode";

export interface PublicGuideHandoff {
  publicUrl: string;
  qrSvg: string | null;
}

async function resolveBaseUrl(): Promise<string> {
  if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL;
  const headersList = await headers();
  const host = headersList.get("host") ?? "localhost:3000";
  const proto = headersList.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

/**
 * Resolve the public guide URL + QR SVG for a slug. Wrapped with React `cache()`
 * so the publishing page and the publishing rail share one QR generation per
 * request instead of computing the same SVG twice.
 */
export const getPublicGuideHandoff = cache(
  async (publicSlug: string | null): Promise<PublicGuideHandoff | null> => {
    if (!publicSlug) return null;
    const baseUrl = await resolveBaseUrl();
    const publicUrl = `${baseUrl}/g/${publicSlug}`;
    let qrSvg: string | null = null;
    try {
      qrSvg = await QRCode.toString(publicUrl, { type: "svg", margin: 1, width: 240 });
    } catch (err) {
      console.error("[public-guide-qr] QR generation failed", err);
    }
    return { publicUrl, qrSvg };
  },
);
