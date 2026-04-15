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

## 5. Security rules

- fotos o vídeos nunca deben exponer secretos en superficies públicas
- la UI debe avisar si una imagen marcada como `public` muestra un lockbox, keypad, código o similar
