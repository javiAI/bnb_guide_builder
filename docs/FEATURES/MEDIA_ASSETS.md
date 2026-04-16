# MEDIA_ASSET_SPEC

## 1. Objetivo

Gestionar fotos y vídeos como assets reutilizables, no como notas sueltas del wizard.

## 2. Asset lifecycle

1. placeholder prompt en wizard o editor
2. upload request
3. asset uploaded
4. metadata completed
5. assignment to entity
6. visibility reviewed
7. publish eligibility checked

## 3. Required fields

- `assetRoleKey`
- `mediaType`
- `storageKey`
- `mimeType`
- `caption`
- `visibility`
- `status`

## 4. Assignment model

Un asset puede usarse en varias entidades:

- property cover
- arrival path
- lockbox or smart lock
- space overview
- amenity instruction
- troubleshooting reference
- ops reference

## 5. Storage provider

**Cloudflare R2** (S3-compatible, egress gratis).

- Endpoint: `https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
- SDK: `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`
- Bucket: `R2_BUCKET` env var (dev: `guide-builder-media`)
- Key structure: `{propertyId}/{assetId}/{sanitizedFileName}`
- Upload: presigned PUT URL (browser → R2 directo, 15 min expiry)
- Download: presigned GET URL (1h expiry)
- Allowed types: `image/jpeg`, `image/png`, `image/webp`, `image/avif`, `image/gif` (10MB), `video/mp4` (100MB)
- Blurhash: generado en `confirmUploadAction` para lazy-loading en guía pública (solo imágenes)
- Env vars requeridas: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`

## 6. Security rules

- fotos o vídeos nunca deben exponer secretos en superficies públicas
- la UI debe avisar si una imagen marcada como `public` muestra un lockbox, keypad, código o similar
