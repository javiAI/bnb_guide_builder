/** Unified result type for all server actions. */
export type ActionResult<T = void> = {
  success: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
  data?: T;
};

/**
 * First user-facing error string from an action result: the top-level `error`,
 * else the first field error, else the given fallback. `null` when the state is
 * absent (e.g. an action that hasn't run yet). Used by the one-click add-chips
 * wrappers, which all surface a single error slot.
 */
export function firstActionError(
  state: ActionResult | null | undefined,
  fallback: string,
): string | null {
  if (!state) return null;
  if (state.error) return state.error;
  if (state.fieldErrors) return Object.values(state.fieldErrors).flat()[0] ?? fallback;
  return null;
}
