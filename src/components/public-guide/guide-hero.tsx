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

// Slot 4 preferred keys — next tier of operational help after access/wifi/location.
// Ordered: parking first (arrival logistics), then most-common policies, then climate.
// Extend here (not in the slot-1-3 selectors) when a new operational key needs hero weight.
const SLOT_4_PREFERRED_KEYS: ReadonlyArray<string> = [
  "am.parking",
  "pol.quiet_hours",
  "pol.no_smoking",
  "pol.pets",
  "am.heating",
  "am.ac",
  "am.climate",
];

const ACCESS_TAXONOMY_KEYS = new Set(["am.smartlock", "am.checkin_instructions"]);

function isAccessItem(item: GuideItemType): boolean {
  if (item.taxonomyKey != null && ACCESS_TAXONOMY_KEYS.has(item.taxonomyKey)) return true;
  return item.id.endsWith("arrival.access") || item.id.endsWith("arrival.checkin");
}

function isWifiItem(item: GuideItemType): boolean {
  return item.taxonomyKey === "am.wifi";
}

function isLocationItem(item: GuideItemType): boolean {
  return item.id.endsWith("arrival.location");
}

/** Curates up to `max` hero answers with intentional priority: access → Wi-Fi →
 * location → best operational help. Falls back to aggregator order to fill
 * remaining slots. Stable when inputs shift: same fixture → same selection. */
export function selectHeroAnswers(
  items: ReadonlyArray<GuideItemType>,
  max: number,
): GuideItemType[] {
  const picked: GuideItemType[] = [];
  const pickedIds = new Set<string>();

  const take = (pred: (item: GuideItemType) => boolean): void => {
    if (picked.length >= max) return;
    const found = items.find((it) => !pickedIds.has(it.id) && pred(it));
    if (found) {
      picked.push(found);
      pickedIds.add(found.id);
    }
  };

  take(isAccessItem);
  take(isWifiItem);
  take(isLocationItem);
  for (const key of SLOT_4_PREFERRED_KEYS) {
    if (picked.length >= max) break;
    take((it) => it.taxonomyKey === key);
  }

  for (const item of items) {
    if (picked.length >= max) break;
    if (!pickedIds.has(item.id)) {
      picked.push(item);
      pickedIds.add(item.id);
    }
  }

  return picked;
}

export function GuideHero({ section, renderable, audience, tree }: Props) {
  const emptyCopy = resolveEmptyCopy(section, audience);
  const answers = selectHeroAnswers(renderable, MAX_HERO_ANSWERS);
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
