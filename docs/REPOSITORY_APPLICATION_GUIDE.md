# REPOSITORY_APPLICATION_GUIDE

## Decisión estratégica

La recomendación para este repositorio es:

- no hacer greenfield total
- sí hacer adopción fuerte de `version_3`
- usar el repo actual como base técnica
- sustituir o refactorizar shells y superficies que no encajen con la IA canónica

## Reutilizar sin cambios grandes

- Prisma + PostgreSQL base
- repositorio de datos y fallback en memoria
- visibilidad y secret boundaries
- guide versions y publishing
- assistant retrieval shell
- audit log shell
- message template persistence
- hardening scripts y tests

## Reutilizar con refactor

- rutas property-centric actuales
- wizard actual
- overview
- preview surfaces
- analytics/settings shell
- message manager UI

## Sustituir o reestructurar

- create property flow actual
- route model del wizard actual
- edición inline sin rutas detalle donde la spec pide detalle dedicado
- taxonomías hardcodeadas en TypeScript
- duplicaciones visuales o de navegación

## Proceso obligatorio de adopción

1. congelar features fuera de la fase activa
2. introducir `version_3` como autoridad documental
3. alinear rutas canónicas y redirects
4. introducir el modelo de datos canónico
5. mover catálogos a taxonomías runtime
6. cerrar media, ops, automations y activity log
7. ejecutar release gates

## Regla de conflicto

Si el repo actual contradice `version_3`:

- mantener seguridad, datos y tests actuales mientras no se migren
- cambiar UX, IA, copy, rutas canónicas y taxonomías hacia `version_3`
- documentar cualquier compatibilidad temporal
