/**
 *   GET /g/:slug/media/:assetId-:hashPrefix/:variant
 *
 * Desacopla el HTML cacheado (ISR/CDN) del ciclo de vida de las URLs
 * presignadas de R2 (1h). La URL incluye un prefijo del `contentHash`
 * para que `Cache-Control: immutable` sea honesto: re-upload = nuevo
 * hash = nueva URL = CDN re-fetch automático.
 *
 * Respuestas:
 *   200 imagen/vídeo con cache headers fuertes (contentHash presente)
 *   206 partial content cuando el cliente envía `Range` (vídeo seek)
 *   304 si el `If-None-Match` coincide con el ETag
 *   404 cualquier fallo de autorización — no se distingue la causa.
 */

import { NextResponse } from "next/server";
import {
  buildCacheHeaders,
  parseAssetIdHash,
  resolvePublicAsset,
} from "@/lib/services/media-proxy.service";
import { streamVariant } from "@/lib/services/media-variants.service";
import { isMediaVariantKey } from "@/lib/types/media-variant";

// AWS SDK + Node streams exigen runtime Node — no Edge.
export const runtime = "nodejs";
// No revalidar en background; la URL es inmutable por contentHash.
export const dynamic = "force-dynamic";

interface RouteParams {
  slug: string;
  assetIdHash: string;
  variant: string;
}

function notFound(): NextResponse {
  return new NextResponse(null, { status: 404 });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<RouteParams> },
): Promise<NextResponse> {
  const { slug, assetIdHash, variant } = await params;

  if (!isMediaVariantKey(variant)) return notFound();

  const parsed = parseAssetIdHash(assetIdHash);
  if (!parsed) return notFound();

  const resolved = await resolvePublicAsset(slug, parsed.assetId, parsed.hashPrefix);
  if (!resolved) return notFound();

  const { asset } = resolved;

  // Conditional request — If-None-Match + strong ETag.
  if (asset.contentHash) {
    const inm = request.headers.get("if-none-match");
    if (inm && inm.replace(/"/g, "") === `${asset.contentHash}-${variant}`) {
      const headers304 = buildCacheHeaders(asset.contentHash, variant, asset.mimeType, null);
      headers304.delete("Content-Length");
      return new NextResponse(null, { status: 304, headers: headers304 });
    }
  }

  const range = request.headers.get("range");

  let stream;
  try {
    stream = await streamVariant(asset, variant, range);
  } catch (err) {
    // Auth already passed in resolvePublicAsset — any failure here is a
    // transport/storage fault. 404 to the client (don't leak internals),
    // but log so ops can see it.
    console.error("media-proxy: streamVariant failed", {
      assetId: asset.id,
      variant,
      err,
    });
    return notFound();
  }

  const headers = buildCacheHeaders(
    asset.contentHash,
    variant,
    stream.contentType,
    stream.contentLength,
  );
  headers.set("Accept-Ranges", "bytes");
  if (stream.contentRange) headers.set("Content-Range", stream.contentRange);

  return new NextResponse(stream.body, { status: stream.status, headers });
}
