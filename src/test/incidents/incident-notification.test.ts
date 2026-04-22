// EmailProvider notification shim (rama 13D). Rama 13D never blocks a
// guest report on notification — provider failures must never surface to
// the caller or the host panel still renders the new incident but the
// guest sees an error they can't recover from.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  NO_OP_EMAIL_PROVIDER,
  notifyHostOfIncident,
  __setEmailProviderForTests,
  type EmailProvider,
  type IncidentNotificationPayload,
} from "@/lib/services/incident-notification.service";

const basePayload: IncidentNotificationPayload = {
  incidentId: "inc-1",
  propertyId: "prop-1",
  propertyName: "Sunset Villa",
  categoryLabel: "Wifi / internet",
  severity: "medium",
  summary: "Wifi lento",
  reportedAt: new Date("2026-04-22T12:00:00Z"),
  hostPanelUrl: "/properties/prop-1/incidents/inc-1",
  recipientEmail: "host@example.com",
};

describe("notifyHostOfIncident", () => {
  beforeEach(() => {
    __setEmailProviderForTests(null);
  });
  afterEach(() => {
    __setEmailProviderForTests(null);
  });

  it("returns no_recipient without calling the provider when email is empty", async () => {
    const spy = vi.fn();
    __setEmailProviderForTests({
      name: "spy",
      send: async () => {
        spy();
        return { sent: true, provider: "spy" };
      },
    });
    const res = await notifyHostOfIncident({ ...basePayload, recipientEmail: "" });
    expect(res.sent).toBe(false);
    expect(res.reason).toBe("no_recipient");
    expect(spy).not.toHaveBeenCalled();
  });

  it("delegates to the injected provider when one is set", async () => {
    const sentPayloads: IncidentNotificationPayload[] = [];
    const provider: EmailProvider = {
      name: "spy",
      async send(payload) {
        sentPayloads.push(payload);
        return { sent: true, provider: "spy" };
      },
    };
    __setEmailProviderForTests(provider);
    const res = await notifyHostOfIncident(basePayload);
    expect(res.sent).toBe(true);
    expect(sentPayloads.length).toBe(1);
    expect(sentPayloads[0].incidentId).toBe("inc-1");
  });

  it("swallows provider errors and returns provider_error", async () => {
    __setEmailProviderForTests({
      name: "flaky",
      async send() {
        throw new Error("smtp timeout");
      },
    });
    const res = await notifyHostOfIncident(basePayload);
    expect(res.sent).toBe(false);
    expect(res.reason).toBe("provider_error");
    expect(res.provider).toBe("flaky");
  });

  it("falls back to the no-op stub when no provider is injected", async () => {
    // With providerOverride = null, resolveProvider returns the no-op stub.
    const res = await notifyHostOfIncident(basePayload);
    expect(res.sent).toBe(true);
    expect(res.provider).toBe("no_op_stub");
  });

  it("NO_OP_EMAIL_PROVIDER emits a structured info log but does not throw", async () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const res = await NO_OP_EMAIL_PROVIDER.send(basePayload);
    expect(res.sent).toBe(true);
    expect(spy).toHaveBeenCalled();
    const raw = spy.mock.calls[0][0] as string;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    expect(parsed.event).toBe("incident_notification_stub");
    expect(parsed.incidentId).toBe("inc-1");
    spy.mockRestore();
  });

  it("__setEmailProviderForTests(null) restores default resolution", async () => {
    __setEmailProviderForTests({
      name: "temp",
      async send() {
        return { sent: true, provider: "temp" };
      },
    });
    __setEmailProviderForTests(null);
    const res = await notifyHostOfIncident(basePayload);
    expect(res.provider).toBe("no_op_stub");
  });
});
