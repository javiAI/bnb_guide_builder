# IMPLEMENTATION_PLAN

## Objetivo

Permitir que un agente implemente la aplicación por fases sin pedir nuevas decisiones humanas.

## Fase 0 · Adopción del kit

- integrar `version_3`
- ejecutar validadores del bundle
- auditar repo actual
- clasificar reutilizable vs refactor vs descartable

## Fase 1 · Foundation and alignment

- tokens visuales
- localización visible al español
- redirects de compatibilidad
- shell base
- estados base de propiedad
- checklist de gaps del repo

## Fase 2 · Canonical data model and runtime loaders

- migraciones Prisma
- nuevos modelos canónicos
- repositorio de datos alineado
- loaders de taxonomías y rules
- write ownership explícito

## Fase 3 · Property creation wizard and workspace shell

- welcome
- 4 pasos
- review
- create usable
- property overview shell
- sidebar definitiva

## Fase 4 · Core editor sections

- Basics
- Arrival
- Policies
- Spaces
- Amenities

## Fase 5 · Taxonomies, dynamic rules, and media prompts

- selector de amenities normalizado
- subtypes
- rule engine declarativo
- media prompts y placeholders
- detalle por space / amenity / troubleshooting

## Fase 6 · Knowledge, guide, AI view, and publishing

- knowledge base
- guide preview
- AI view
- gate engine
- publish action
- export payloads

## Fase 7 · Assistant and retrieval

- ask endpoint
- retrieval pipeline
- citations
- confidence gating
- debug retrieval
- conversations y message log

## Fase 8 · Messaging and automation

- template CRUD
- touchpoint detail
- automations
- preview rendering
- starter packs
- send safety rules

## Fase 9 · Ops, analytics, settings, media, activity

- cleaning and ops
- stock
- maintenance
- media library
- analytics y gaps
- review queue
- settings
- activity log

## Fase 10 · QA, hardening, release, and cutover

- smoke tests
- evals
- release checklist
- visibility regression suite
- cutover plan desde rutas legacy

## Regla de secuencia

No saltar fases.
No implementar features de una fase posterior dentro de una fase previa salvo dependencias técnicas mínimas documentadas.
