// ── Schemas ──
export {
  WIZARD_STEPS,
  getWizardStep,
  type WizardStepDef,
  type FieldDef,
  type FieldGroup,
  type FieldType,
} from "./schemas/wizard-steps";

export {
  SECTION_EDITORS,
  getSectionEditor,
  getSectionsByGroup,
  getSectionsForPhase,
  type SectionEditorDef,
  type SectionStatus,
} from "./schemas/section-editors";

export {
  resolveFieldDependencies,
  getAllTriggers,
  getAllDependentFields,
  getRulesShowingField,
  type DependencyResult,
} from "./schemas/field-dependencies";

// ── Registries ──
export {
  SECTION_ICONS,
  PROPERTY_TYPE_ICONS,
  ACCESS_METHOD_ICONS,
  AMENITY_GROUP_ICONS,
  lookupIcon,
} from "./registries/icon-registry";

export {
  RENDER_CONFIGS,
  getRenderConfig,
  getRenderConfigsForTarget,
  type RenderConfig,
  type OutputTarget,
} from "./registries/renderer-registry";

export {
  getMediaRequirementsForSection,
  getMediaRequirement,
  getRequiredMedia,
  getRecommendedMedia,
  validateSectionMedia,
} from "./registries/media-registry";
