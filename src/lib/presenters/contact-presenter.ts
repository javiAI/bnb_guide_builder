import type {
  GuideAudience,
  GuideItem,
  GuideItemDisplayField,
} from "@/lib/types/guide-tree";
import type { Presenter, PresenterOutput } from "./types";

/** Contact items carry `value: c.roleKey` (e.g., `ct.host`) from the resolver.
 * That role key is a leak for guest — the role is already expressed by
 * `item.label` ("Anfitrión"). For guest this presenter drops `value`; for
 * other audiences it passes the raw role key through so operators still see
 * the identifier. */
export const contactPresenter: Presenter = (
  item: GuideItem,
  audience: GuideAudience,
): PresenterOutput => {
  const displayFields: GuideItemDisplayField[] = item.fields.map((f) => ({
    label: f.label,
    displayValue: f.value,
    visibility: f.visibility,
  }));

  const displayValue = audience === "guest" ? "" : item.value ?? "";

  return {
    presentationType: "contact",
    displayValue,
    displayFields,
    warnings: [],
  };
};
