# SKILL · Data platform

## Objetivo

Cerrar el modelo de datos canónico, sus migraciones y la separación entre captura, entidades canónicas y capas derivadas.

## Reglas

- Prisma + PostgreSQL
- un único write owner por hecho de negocio
- `WizardResponse` no sustituye entidades canónicas
- secretos segregados
- índices para retrieval, publish y review queue
