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

function getR2Config() {
  return {
    accountId: process.env.R2_ACCOUNT_ID ?? "",
    accessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
    bucket: process.env.R2_BUCKET ?? "",
  };
}

export function getR2Bucket(): string {
  const bucket = getR2Config().bucket;
  if (!bucket) throw new Error("Missing R2_BUCKET env var");
  return bucket;
}

const UPLOAD_EXPIRES_SECONDS = 15 * 60; // 15 min
const DOWNLOAD_EXPIRES_SECONDS = 60 * 60; // 1 hour
const DOWNLOAD_CACHE_TTL_MS = 55 * 60 * 1000; // 55 min (5 min buffer before URL expires)

// ── Download URL cache ─────────────────────────────────

interface CachedUrl {
  url: string;
  expiresAt: number;
}

const _downloadUrlCache = new Map<string, CachedUrl>();

function getCachedDownloadUrl(storageKey: string): string | null {
  const entry = _downloadUrlCache.get(storageKey);
  if (!entry) return null;
  if (Date.now() >= entry.expiresAt) {
    _downloadUrlCache.delete(storageKey);
    return null;
  }
  return entry.url;
}

function setCachedDownloadUrl(storageKey: string, url: string): void {
  _downloadUrlCache.set(storageKey, {
    url,
    expiresAt: Date.now() + DOWNLOAD_CACHE_TTL_MS,
  });
}

/** Invalidate a cached URL (e.g. after object deletion). */
export function invalidateDownloadUrlCache(storageKey: string): void {
  _downloadUrlCache.delete(storageKey);
}

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
  const cfg = getR2Config();
  if (!cfg.accountId || !cfg.accessKeyId || !cfg.secretAccessKey || !cfg.bucket) {
    throw new Error(
      "Missing R2 env vars. Required: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET",
    );
  }
  _client = new S3Client({
    region: "auto",
    endpoint: `https://${cfg.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
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
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: getR2Config().bucket,
    Key: storageKey,
    ContentType: contentType,
  });
  return getSignedUrl(getS3Client(), command, {
    expiresIn: UPLOAD_EXPIRES_SECONDS,
  });
}

export async function getDownloadUrl(storageKey: string): Promise<string> {
  const cached = getCachedDownloadUrl(storageKey);
  if (cached) return cached;

  const command = new GetObjectCommand({
    Bucket: getR2Config().bucket,
    Key: storageKey,
  });
  const url = await getSignedUrl(getS3Client(), command, {
    expiresIn: DOWNLOAD_EXPIRES_SECONDS,
  });

  setCachedDownloadUrl(storageKey, url);
  return url;
}

// ── Object operations ───────────────────────────────────

export async function deleteObject(storageKey: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: getR2Config().bucket,
    Key: storageKey,
  });
  await getS3Client().send(command);
}

export async function headObject(
  storageKey: string,
): Promise<{ contentLength: number; contentType: string; etag: string | null } | null> {
  try {
    const command = new HeadObjectCommand({
      Bucket: getR2Config().bucket,
      Key: storageKey,
    });
    const result = await getS3Client().send(command);
    const rawEtag = result.ETag ?? null;
    return {
      contentLength: result.ContentLength ?? 0,
      contentType: result.ContentType ?? "application/octet-stream",
      etag: rawEtag ? rawEtag.replace(/"/g, "").trim() || null : null,
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
