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

## 7. Public media proxy

Ruta estable pública: `GET /g/:slug/media/:assetId-:hashPrefix/:variant` (Rama 10D). Desacopla el HTML cacheado (ISR/CDN) del ciclo de vida de las URLs presignadas de R2 (1h), de modo que `Cache-Control: immutable` es honesto — una HTML cacheada durante semanas sigue sirviendo media sin romperse al caducar la firma.

### Estructura de URL

- `:slug` — `Property.publicSlug`.
- `:assetId-:hashPrefix` — cuid del `MediaAsset` + primeros 8 chars del `contentHash`. Re-upload ⇒ nuevo hash ⇒ nueva URL ⇒ CDN re-fetch automático.
- `:variant` — `thumb` | `md` | `full`. Los cuids no contienen guiones, así que el último `-` separa id y hash sin ambigüedad.

### Variantes

Actualmente las tres variantes son **passthrough** al binario original. La interfaz `streamVariant(asset, variant, range)` es estable — una futura rama enchufará transformación real (Sharp in-Node o Cloudflare Image Resizing) sin cambiar consumidores.

| Variante | `maxWidthPx` | Uso |
| --- | --- | --- |
| `thumb` | 256 | thumbnails, listados |
| `md` | 800 | galería pública |
| `full` | null | lightbox, descarga |

### Cache policy

- `contentHash` presente → `Cache-Control: public, max-age=31536000, immutable` + ETag `"{contentHash}-{variant}"`. El ETag se **escopa a la variante** para que un CDN que cacheó `full` no sirva esos bytes para `thumb`.
- `contentHash` ausente (pre-backfill) → `Cache-Control: public, max-age=3600, must-revalidate` sin ETag. Política transitoria hasta que `scripts/backfill-media-content-hash.ts` ejecute.

Conditional requests (`If-None-Match`) devuelven 304 cuando el ETag coincide; Range requests se propagan a R2 y devuelven 206 con `Content-Range` (necesario para seek de `<video>` en Safari iOS).

### Autorización

Un asset es público si y solo si **todas** las siguientes condiciones se cumplen:

1. `asset.property.publicSlug != null`
2. `asset.property.publicSlug === :slug` de la URL
3. `asset.property` tiene al menos un `GuideVersion.status = "published"` (verificado vía `_count` en la misma query)

Cualquier fallo (asset no existe, slug no coincide, no hay versión publicada, hash prefix no coincide) devuelve **404** sin distinguir la causa — no se filtra información al atacante.

### Nunca presignadas en HTML cacheado

`composeGuide()` emite URLs relativas `/g/:slug/media/...` en `GuideTree`. Hay invariantes en `src/test/guide-rendering-proxy-urls.test.ts` que fallan si alguna URL en `GuideItem.media[]` contiene `r2.cloudflarestorage.com` o `X-Amz-*`.

### En el guide rendering (Rama 10C)

`composeGuide()` inyecta los assets de cada entidad en `GuideItem.media[]` a través de `loadEntityMedia()` (una sola query `mediaAssignment.findMany` por compose, agrupada por `entityType` con `OR` clauses — **no N+1**). Cada entry tiene la forma:

```ts
interface GuideMedia {
  assetId: string;                      // cuid del MediaAsset
  variants: { thumb: string; md: string; full: string };
  mimeType: string;
  alt: string;                          // caption || `${role} — ${entityLabel}`
  role?: string;                        // usageKey ?? assetRoleKey
  caption?: string;
}
```

- **Todas las variantes se emiten siempre**, aunque 10C inline sólo use `md`. El fingerprint de diff y el caché del CDN se escopan a la variante, así que `variants.thumb` y `variants.full` viajan listas para 10E (galería con lightbox).
- **Filtrado por audiencia**: `isVisibleForAudience(asset.visibility, audience)` descarta media cuya visibility excede el tier del consumidor. `sensitive` nunca entra en el tree.
- **Filtro por `includesMedia`**: `taxonomies/guide_sections.json` marca qué secciones aceptan media (`arrival`, `spaces`, `amenities`). `rules`, `contacts`, `emergency`, `local` tienen `includesMedia: false` — la ref list no incluye sus entidades y el loader no las consulta. `local` flipea a `true` cuando llegue la rama 13D (media en lugares locales).
- **Scope de entidades en 10C**: `property` (cover → primer item sintético `arrival.property`), `space`, `amenity_instance`, `access_method` (propertyId compartido, label del taxonomy).
- **Cap en renderers**: `INLINE_MEDIA_CAP = 3` en markdown y HTML para mantener el output escaneable. El PDF aplica el mismo cap implícito via filtro de URLs absolutas.
- **Alt text**: caption textual si existe; fallback WCAG a `"{role formateado} — {entityLabel}"` (`photo_gallery` → `"photo gallery — Dormitorio principal"`).
- **Orden**: cover primero (`usageKey="cover"` ordena antes de null en ASC), luego `sortOrder` ASC.

Nunca se emiten URLs presignadas — todas pasan por `buildMediaProxyUrl(slug, assetId, contentHash, variant)`. Si `publicSlug` es `null` (preview / unpublished), el loader devuelve un mapa vacío y el tree sale sin media.

### Backfill de `contentHash`

```bash
npx tsx scripts/backfill-media-content-hash.ts [--dry-run]
```

Usa `headObject()` para traer el `ETag` de R2 (MD5 hex para uploads no-multipart, que es nuestro caso) y lo copia a `MediaAsset.contentHash`. Seguro de re-ejecutar — los assets que ya tienen hash se saltan.
