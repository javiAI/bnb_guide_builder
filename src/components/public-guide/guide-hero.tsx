import type {
  GuideAudience,
  GuideItem as GuideItemType,
  GuideSection,
  GuideTree,
} from "@/lib/types/guide-tree";
import { resolveQuickActions } from "@/config/registries/quick-action-registry";
import { resolveEmptyCopy } from "@/lib/renderers/_guide-display";
import { GuideItem } from "./guide-item";
import { GuideEmptyState } from "./guide-empty-state";
import { GuideToastProvider } from "./toast";
import { QuickActionButton } from "./quick-action-button";

interface Props {
  section: GuideSection;
  renderable: GuideItemType[];
  audience: GuideAudience;
  tree: GuideTree;
}

const MAX_HERO_ANSWERS = 4;

export function GuideHero({ section, renderable, audience, tree }: Props) {
  const emptyCopy = resolveEmptyCopy(section, audience);
  const answers = renderable.slice(0, MAX_HERO_ANSWERS);
  const actions = section.quickActionKeys
    ? resolveQuickActions(section.quickActionKeys, tree)
    : [];

  return (
    <GuideToastProvider>
      <section
        id={section.id}
        className="guide-section guide-section--hero"
        aria-labelledby={`${section.id}-title`}
      >
        <header className="guide-section__header">
          <h2 id={`${section.id}-title`} className="guide-section__title">
            {section.label}
          </h2>
        </header>
        {actions.length > 0 && (
          <div
            className="guide-quick-actions"
            role="group"
            aria-label="Acciones rápidas"
          >
            {actions.map((action) => (
              <QuickActionButton key={action.id} action={action} />
            ))}
          </div>
        )}
        {answers.length === 0 ? (
          <GuideEmptyState copy={emptyCopy ?? undefined} />
        ) : (
          <div className="guide-items">
            {answers.map((item) => (
              <GuideItem key={item.id} item={item} />
            ))}
          </div>
        )}
      </section>
    </GuideToastProvider>
  );
}
