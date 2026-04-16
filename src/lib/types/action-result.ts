/**
 * Unified result type for all server actions.
 *
 * @template T — optional payload type (default `void`).
 */
export type ActionResult<T = void> = {
  success: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
  data?: T;
};
