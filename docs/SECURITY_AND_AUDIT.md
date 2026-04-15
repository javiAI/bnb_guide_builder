# SECURITY_VISIBILITY_AND_AUDIT

## 1. Visibility levels

- `public`
- `booked_guest`
- `internal`
- `secret`

## 2. Enforcement

- servidor como autoridad final
- Zod en inputs
- filtrado de retrieval y render en backend
- activity log para mutaciones relevantes

## 3. Secret policy

Secretos incluyen:

- códigos de acceso
- ubicaciones ocultas de llaves
- contraseñas internas
- tokens
- credenciales de smart locks

No deben:

- vivir en `KnowledgeItem`
- salir en mensajes por defecto
- entrar en previews públicas
- aparecer en logs o diffs sin sanitizar

## 4. Audit model

`AuditLog` debe registrar:

- actor
- entidad
- acción
- diff seguro
- fecha

## 5. Review queue

La review queue es derivada y debe cubrir:

- stale content
- low confidence
- missing media
- missing publish requirements
- unresolved visibility issues
