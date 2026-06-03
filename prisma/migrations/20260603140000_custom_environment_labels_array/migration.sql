-- "Otro" entorno becomes multi-valued (the operator can add several custom
-- environments in the multiselect). Single label → array of labels.
ALTER TABLE "properties" DROP COLUMN "custom_environment_label";
ALTER TABLE "properties" ADD COLUMN "custom_environment_labels" TEXT[];
