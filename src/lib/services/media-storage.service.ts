/**
 * Cloudflare R2 storage service — S3-compatible presigned URL operations.
 *
 * Uses @aws-sdk/client-s3 with R2 endpoint. All uploads go browser → R2
 * directly via presigned PUT URL (server never touches the bytes).
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// ── Config ──────────────────────────────────────────────

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID ?? "";
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID ?? "";
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY ?? "";
const R2_BUCKET = process.env.R2_BUCKET ?? "";

const UPLOAD_EXPIRES_SECONDS = 15 * 60; // 15 min
const DOWNLOAD_EXPIRES_SECONDS = 60 * 60; // 1 hour

/** Allowed MIME types and their max size in bytes. */
export const ALLOWED_MEDIA: Record<string, number> = {
  "image/jpeg": 10 * 1024 * 1024,
  "image/png": 10 * 1024 * 1024,
  "image/webp": 10 * 1024 * 1024,
  "image/avif": 10 * 1024 * 1024,
  "image/gif": 10 * 1024 * 1024,
  "video/mp4": 100 * 1024 * 1024,
};

// ── S3 Client ───────────────────────────────────────────

let _client: S3Client | null = null;

export function getS3Client(): S3Client {
  if (_client) return _client;
  _client = new S3Client({
    region: "auto",
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });
  return _client;
}

/** Visible for testing — replaces the singleton with a mock. */
export function _setS3ClientForTest(client: S3Client): void {
  _client = client;
}

// ── Storage key ─────────────────────────────────────────

/**
 * Build the object key: `{propertyId}/{assetId}/{fileName}`.
 * Sanitises fileName to ASCII-safe characters.
 */
export function buildStorageKey(
  propertyId: string,
  assetId: string,
  fileName: string,
): string {
  const safe = fileName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 200);
  return `${propertyId}/${assetId}/${safe}`;
}

// ── Presigned URLs ──────────────────────────────────────

export async function getUploadUrl(
  storageKey: string,
  contentType: string,
  maxSizeBytes: number,
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: storageKey,
    ContentType: contentType,
    ContentLength: maxSizeBytes,
  });
  return getSignedUrl(getS3Client(), command, {
    expiresIn: UPLOAD_EXPIRES_SECONDS,
  });
}

export async function getDownloadUrl(storageKey: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: R2_BUCKET,
    Key: storageKey,
  });
  return getSignedUrl(getS3Client(), command, {
    expiresIn: DOWNLOAD_EXPIRES_SECONDS,
  });
}

// ── Object operations ───────────────────────────────────

export async function deleteObject(storageKey: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: R2_BUCKET,
    Key: storageKey,
  });
  await getS3Client().send(command);
}

export async function headObject(
  storageKey: string,
): Promise<{ contentLength: number; contentType: string } | null> {
  try {
    const command = new HeadObjectCommand({
      Bucket: R2_BUCKET,
      Key: storageKey,
    });
    const result = await getS3Client().send(command);
    return {
      contentLength: result.ContentLength ?? 0,
      contentType: result.ContentType ?? "application/octet-stream",
    };
  } catch (err) {
    if (
      typeof err === "object" &&
      err !== null &&
      "name" in err &&
      (err as { name: string }).name === "NotFound"
    ) {
      return null;
    }
    throw err;
  }
}
