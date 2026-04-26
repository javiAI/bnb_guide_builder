-- Audit log scope generalizado a property-agnostic (Rama 15D).
--
-- Antes de 15D la tabla `audit_logs` tenía writers solo declarados (no
-- invocados); el writer real introducido por 15D necesita escribir filas de
-- ámbito global (session.start / session.end) sin propertyId. Hacemos la FK
-- nullable y reescribimos los índices que la usan para tolerar NULL.
--
-- - `property_id` → opcional, FK con ON DELETE CASCADE preservada.
-- - Ningún cambio de datos: la columna no tenía writers reales que ahora
--   queden inconsistentes (la página `/activity` lee y devuelve vacío).

ALTER TABLE "audit_logs"
  DROP CONSTRAINT "audit_logs_property_id_fkey";

ALTER TABLE "audit_logs"
  ALTER COLUMN "property_id" DROP NOT NULL;

ALTER TABLE "audit_logs"
  ADD CONSTRAINT "audit_logs_property_id_fkey"
    FOREIGN KEY ("property_id") REFERENCES "properties"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
