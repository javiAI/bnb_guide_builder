import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock the scheduler so the route test is isolated.
const runTickMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/services/local-events/scheduler", () => ({
  runLocalEventsTick: runTickMock,
}));

import { POST } from "@/app/api/cron/local-events/route";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
  runTickMock.mockReset();
  runTickMock.mockResolvedValue({
    now: "2026-04-21T20:00:00.000Z",
    propertiesScanned: 0,
    perProperty: [],
    providersConfigured: ["predicthq", "firecrawl", "ticketmaster"],
    horizonDays: 60,
  });
});

function makeRequest(authHeader?: string): Request {
  return new Request("https://example.com/api/cron/local-events", {
    method: "POST",
    headers: authHeader ? { authorization: authHeader } : {},
  });
}

describe("POST /api/cron/local-events", () => {
  it("returns 500 when CRON_SECRET is not configured", async () => {
    delete process.env.CRON_SECRET;
    const res = await POST(makeRequest("Bearer whatever"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("cron_secret_not_configured");
    expect(runTickMock).not.toHaveBeenCalled();
  });

  it("returns 401 when Authorization header is missing", async () => {
    process.env.CRON_SECRET = "sekret";
    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("unauthorized");
    expect(runTickMock).not.toHaveBeenCalled();
  });

  it("returns 401 when Bearer token does not match CRON_SECRET", async () => {
    process.env.CRON_SECRET = "sekret";
    const res = await POST(makeRequest("Bearer wrong"));
    expect(res.status).toBe(401);
    expect(runTickMock).not.toHaveBeenCalled();
  });

  it("returns 401 when Authorization header is malformed (no Bearer prefix)", async () => {
    process.env.CRON_SECRET = "sekret";
    const res = await POST(makeRequest("sekret"));
    expect(res.status).toBe(401);
  });

  it("runs the tick and returns 200 when Bearer token matches", async () => {
    process.env.CRON_SECRET = "sekret";
    const res = await POST(makeRequest("Bearer sekret"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.report.propertiesScanned).toBe(0);
    expect(runTickMock).toHaveBeenCalledTimes(1);
  });
});
