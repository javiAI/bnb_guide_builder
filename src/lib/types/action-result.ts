/** Unified result type for all server actions. */
export type ActionResult<T = void> = {
  success: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
  data?: T;
};
