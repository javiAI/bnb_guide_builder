-- Distribución (layoutKey) retirada en 16I-2: era una simplificación property-level
-- de una realidad por-espacio; los espacios se configuran libremente en Espacios.
ALTER TABLE "properties" DROP COLUMN "layout_key";

-- Entorno gana opción "Otro" (env.other) con etiqueta libre — mismo patrón que
-- custom_property_type_label / custom_room_type_label.
ALTER TABLE "properties" ADD COLUMN "custom_environment_label" TEXT;
