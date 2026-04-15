# ROADMAP

Estado actual y próximos pasos. Este documento es el punto de entrada rápido; el detalle ejecutable vive en `MASTER_PLAN_V2.md`.

## Donde estamos (2026-04-15)

### Completado — MASTER_PLAN v1 (fases 1A-7B, 20 PRs)

Ver `archive/v1-master-plan-executed.md` para el detalle. Highlights:

- Motor condicional unificado (`src/lib/conditional-engine/`)
- Modelo amenities v2 (`PropertyAmenityInstance` + `Placement`), legacy eliminado
- Subtypes + derivations + cross-validations
- `PropertyDerived` cache + completeness scoring
- Overview con gaps/blockers/next-action
- Spaces: overlays por propertyType + archive + wizard seed tracking
- Troubleshooting linking + Incident model
- `VisibilityLevel` enum
- 8 amenity additions (Rama 7B)

### Pendiente del plan v1

Solo `7C — completeness calibration`, measurement-dependent. Ver `FUTURE.md`.

---

## Siguiente — MASTER_PLAN v2 (fases 8-14)

Fuente de verdad ejecutable: [MASTER_PLAN_V2.md](MASTER_PLAN_V2.md).

| Fase | Título | Ramas | Riesgo | Esfuerzo |
|---|---|---:|---|---|
| 8 | Deuda técnica pre-output | 3 | Bajo | 2-3 días |
| 9 | Guest Guide v2 (output principal) | 4 | Medio | 2-3 sem |
| 10 | Media real (S3) | 3 | Bajo | 1 sem |
| 11 | Knowledge + Assistant | 4 | Alto | 3-4 sem |
| 12 | Messaging con variables | 3 | Medio | 1-2 sem |
| 13 | Guía local enriquecida | 3 | Bajo | 1-2 sem |
| 14 | Platform integrations (Airbnb/Booking) | 4 | Alto | multi-mes |

### Orden sugerido

1. **Ahora**: Fase 8 (desbloquea todo lo demás barato)
2. **Sprint siguiente**: 9 + 10 en paralelo (output + media se necesitan juntos)
3. **Mes 2**: 11 (Knowledge + Assistant — diferenciador del producto)
4. **Mes 3**: 12 + 13 en paralelo
5. **Q siguiente**: 14 si hay decisión estratégica de plataformas

---

## Futuro diferido

Trabajo con trigger condicional — ver [FUTURE.md](FUTURE.md):

- Admin UI para taxonomías (4 niveles)
- Calibración de completeness (post-uso real)
