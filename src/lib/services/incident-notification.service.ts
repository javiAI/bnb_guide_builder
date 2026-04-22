/**
 * Email notification for guest-originated incidents (Rama 13D).
 *
 * Designed as an abstraction so 12B (or whatever lands the transactional
 * provider) can plug in without reshaping callers. Today the default path is
 * a no-op stub that logs the outbound shape. The notification never blocks a
 * guest report — failure to notify is logged and swallowed.
 *
 * Rationale for no-op in prod (not fail-fast like the assistant pipeline):
 * the guest already has feedback ("report sent") and the host can see the
 * incident on the panel. Pretending the report failed because mail isn't
 * wired would be worse than silent no-op + log.
 */

export interface IncidentNotificationPayload {
  incidentId: string;
  propertyId: string;
  propertyName: string;
  categoryLabel: string;
  severity: "low" | "medium" | "high";
  summary: string;
  reportedAt: Date;
  /** Absolute URL the host can click to open the panel entry. Built by the
   *  caller so the service stays dependency-free. */
  hostPanelUrl: string;
  recipientEmail: string;
}

export interface NotificationResult {
  sent: boolean;
  provider: string;
  /** Reason populated when `sent === false`. Used by the caller to decide
   *  whether to log at info or warn severity. */
  reason?: "no_recipient" | "no_provider" | "provider_error";
}

export interface EmailProvider {
  readonly name: string;
  send(payload: IncidentNotificationPayload): Promise<NotificationResult>;
}

// Logged-only implementation. Emits a single structured console line so tests
// and local development can see what would have been sent.
export const NO_OP_EMAIL_PROVIDER: EmailProvider = {
  name: "no_op_stub",
  async send(payload) {
    // `console.info` is fine here — the stub is explicitly informational, not
    // an error. Structured single-line JSON keeps log aggregators happy.
    console.info(
      JSON.stringify({
        event: "incident_notification_stub",
        incidentId: payload.incidentId,
        recipient: payload.recipientEmail,
        subject: `[${payload.severity.toUpperCase()}] ${payload.categoryLabel} — ${payload.propertyName}`,
      }),
    );
    return { sent: true, provider: "no_op_stub" };
  },
};

let providerOverride: EmailProvider | null = null;

/** Test hook — inject a provider stub. Passing `null` resets to auto-resolution. */
export function __setEmailProviderForTests(provider: EmailProvider | null): void {
  providerOverride = provider;
}

/**
 * Resolve the active provider. Until a real implementation ships (pending
 * 12B), `EMAIL_PROVIDER` env var is always treated as absent → no-op stub.
 * A future provider registration would dispatch here (e.g. `case "resend":
 * return resendProvider`).
 */
function resolveProvider(): EmailProvider {
  if (providerOverride) return providerOverride;
  return NO_OP_EMAIL_PROVIDER;
}

export async function notifyHostOfIncident(
  payload: IncidentNotificationPayload,
): Promise<NotificationResult> {
  if (!payload.recipientEmail) {
    return { sent: false, provider: "none", reason: "no_recipient" };
  }
  const provider = resolveProvider();
  try {
    return await provider.send(payload);
  } catch (err) {
    // Never surface a provider error to the caller — the incident is already
    // persisted; the guest-facing flow is green. Log and swallow.
    console.warn(
      JSON.stringify({
        event: "incident_notification_error",
        incidentId: payload.incidentId,
        provider: provider.name,
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    return { sent: false, provider: provider.name, reason: "provider_error" };
  }
}
