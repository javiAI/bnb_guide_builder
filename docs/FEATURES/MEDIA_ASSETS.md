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

`MediaAssignment` usa polimorfismo: `entityType` + `entityId` apuntan a cualquier entidad.

### entityTypes soportados

| entityType | Entidad | entityId |
| --- | --- | --- |
| `property` | Propiedad (portada, fotos generales) | propertyId |
| `space` | Espacio (dormitorio, baño, cocina...) | space.id |
| `access_method` | Acceso (lockbox, portal, camino...) | propertyId |
| `amenity_instance` | Equipamiento específico | amenityInstance.id |
| `system` | Sistema (calefacción, WiFi...) | system.id |

`local_place` se añadirá en fase 13 cuando exista la entidad.

### Constraint de unicidad

`@@unique([mediaAssetId, entityType, entityId])` — un asset no puede asignarse dos veces a la misma entidad.

### Cover photo

`usageKey = "cover"` marca un assignment como portada de su entidad. Máximo 1 cover por entidad (validado en `setCoverAction`, que limpia el anterior antes de asignar).

### Reordenación

`sortOrder` (int, 0-based) define el orden visual. `reorderMediaAction` recibe la lista completa de IDs ordenada y actualiza en transacción.

### Uso directo

Un asset se asigna a entidades específicas:

- property cover / fotos generales
- arrival path, lockbox, smart lock
- space overview
- amenity instruction
- system reference
- troubleshooting / ops reference (futuro)

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
