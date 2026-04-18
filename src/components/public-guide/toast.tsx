"use client";
import * as React from "react";
import * as Toast from "@radix-ui/react-toast";

interface GuideToastContextValue {
  toast(message: string): void;
}

const GuideToastContext = React.createContext<GuideToastContextValue | null>(null);

export function useGuideToast(): GuideToastContextValue {
  const ctx = React.useContext(GuideToastContext);
  if (!ctx) {
    throw new Error("useGuideToast must be used inside <GuideToastProvider>");
  }
  return ctx;
}

/** Feedback toast for quick actions (copy confirmations).
 *
 * Radix `Toast.Root` emits `role="status"` with `aria-live="assertive"`
 * when `type="foreground"` (default) — satisfies the a11y requirement
 * without extra wiring. The viewport listens for Escape to dismiss. */
export function GuideToastProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = React.useState<string>("");
  const [open, setOpen] = React.useState(false);

  const toast = React.useCallback((msg: string) => {
    setMessage(msg);
    setOpen(false);
    requestAnimationFrame(() => setOpen(true));
  }, []);

  return (
    <Toast.Provider duration={2000} swipeDirection="right">
      <GuideToastContext.Provider value={{ toast }}>
        {children}
      </GuideToastContext.Provider>
      <Toast.Root
        open={open}
        onOpenChange={setOpen}
        className="guide-toast"
      >
        <Toast.Title className="guide-toast__title">{message}</Toast.Title>
      </Toast.Root>
      <Toast.Viewport className="guide-toast-viewport" />
    </Toast.Provider>
  );
}
