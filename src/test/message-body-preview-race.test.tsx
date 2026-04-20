// Latest-request-wins guard on TemplatePreview.
//
// Scenario: user edits fast → request A dispatched, request B dispatched
// later, B responds first, then A responds. Without the guard, A would
// overwrite B's state with stale data. The monotonic requestId ref drops
// any response whose id no longer matches the current ref.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { TemplatePreview } from "@/app/properties/[propertyId]/messaging/[touchpointKey]/message-body-editor";

type Deferred = {
  body: string;
  resolve: (result: {
    success: true;
    output: string;
    states: Record<string, never>;
    counts: {
      resolved: number;
      missing: number;
      unknown: number;
      unresolvedContext: number;
    };
  }) => void;
};

const deferreds: Deferred[] = [];

vi.mock("@/lib/actions/messaging.actions", () => ({
  previewMessageTemplateAction: vi.fn(
    (_propertyId: string, body: string) =>
      new Promise((resolve) => {
        deferreds.push({ body, resolve: resolve as Deferred["resolve"] });
      }),
  ),
}));

beforeEach(() => {
  deferreds.length = 0;
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

function makeResult(output: string) {
  return {
    success: true as const,
    output,
    states: {},
    counts: { resolved: 0, missing: 0, unknown: 0, unresolvedContext: 0 },
  };
}

describe("TemplatePreview — latest-request-wins guard", () => {
  it("drops stale response from an earlier body once a newer body's response lands", async () => {
    const { rerender } = render(<TemplatePreview propertyId="p1" body="OLD" />);

    // Advance past the 400ms debounce → request A dispatched.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    expect(deferreds).toHaveLength(1);
    expect(deferreds[0].body).toBe("OLD");

    // Body changes before A responds → effect re-runs, cleanup fires,
    // requestId bumps, new debounce begins.
    rerender(<TemplatePreview propertyId="p1" body="NEW" />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    expect(deferreds).toHaveLength(2);
    expect(deferreds[1].body).toBe("NEW");

    // Out-of-order resolution: B (newer) responds first, A (older) after.
    await act(async () => {
      deferreds[1].resolve(makeResult("NEW output"));
    });
    expect(screen.getByText("NEW output")).toBeTruthy();

    await act(async () => {
      deferreds[0].resolve(makeResult("OLD output"));
    });

    // Guard: stale A response must NOT overwrite B's state.
    expect(screen.getByText("NEW output")).toBeTruthy();
    expect(screen.queryByText("OLD output")).toBeNull();
  });
});
