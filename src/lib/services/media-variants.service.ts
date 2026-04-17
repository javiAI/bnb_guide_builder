/**
 * Serves bytes for a (asset, variant) pair. Currently every variant is a
 * passthrough to the stored object — a later transformation layer (Sharp
 * in-Node or CF Image Resizing) will plug in behind this same interface
 * without changing callers.
 *
 * Range forwarding is preserved so `<video src="/g/...mp4/full">` seeks
 * work on Safari iOS.
 */

import { GetObjectCommand } from "@aws-sdk/client-s3";
import type { MediaAsset } from "@prisma/client";
import { getR2Bucket, getS3Client } from "@/lib/services/media-storage.service";
import type { MediaVariantKey } from "@/lib/types/media-variant";

export interface VariantStream {
  body: ReadableStream<Uint8Array>;
  contentLength: number | null;
  contentType: string;
  /** Status to propagate (200 or 206 for partial Range responses). */
  status: 200 | 206;
  /** Content-Range header value when `status === 206`, else `null`. */
  contentRange: string | null;
  acceptRanges: boolean;
}

export async function streamVariant(
  asset: MediaAsset,
  _variant: MediaVariantKey,
  range: string | null,
): Promise<VariantStream> {
  const command = new GetObjectCommand({
    Bucket: getR2Bucket(),
    Key: asset.storageKey,
    ...(range ? { Range: range } : {}),
  });

  const result = await getS3Client().send(command);
  const body = result.Body;
  if (!body || typeof (body as { transformToWebStream?: () => unknown }).transformToWebStream !== "function") {
    throw new Error("R2 GetObject returned no streamable body");
  }
  const webStream = (body as { transformToWebStream: () => ReadableStream<Uint8Array> })
    .transformToWebStream();

  const contentType = result.ContentType ?? asset.mimeType;
  const contentLength = typeof result.ContentLength === "number" ? result.ContentLength : null;
  const isPartial = range != null && result.ContentRange != null;

  return {
    body: webStream,
    contentLength,
    contentType,
    status: isPartial ? 206 : 200,
    contentRange: result.ContentRange ?? null,
    acceptRanges: true,
  };
}
