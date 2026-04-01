import { act, render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { QuoteActivity } from "@/components/quotes/quote-activity";

let sseCallback: (() => void) | undefined;

vi.mock("@/domains/quote/api-client", () => ({
  quoteApi: {
    getViews: vi.fn(),
    getFollowUps: vi.fn(),
  },
}));

vi.mock("@/lib/use-sse", () => ({
  useSSE: vi.fn((_eventType: string, callback: () => void) => {
    sseCallback = callback;
  }),
}));

import { quoteApi } from "@/domains/quote/api-client";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe("QuoteActivity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sseCallback = undefined;
  });

  it("refetches activity when a quote-changed SSE event arrives", async () => {
    vi.mocked(quoteApi.getViews)
      .mockResolvedValueOnce([
        {
          id: "view-1",
          viewedAt: "2026-03-31T17:00:00.000Z",
          ipAddress: "1.1.1.1",
          userAgent: "Chrome",
          referrer: null,
          viewport: "1440x900",
          durationSeconds: 30,
          respondedWith: null,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "view-1",
          viewedAt: "2026-03-31T17:00:00.000Z",
          ipAddress: "1.1.1.1",
          userAgent: "Chrome",
          referrer: null,
          viewport: "1440x900",
          durationSeconds: 30,
          respondedWith: null,
        },
      ]);

    vi.mocked(quoteApi.getFollowUps)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "fu-1",
          type: "PAYMENT_REMINDER",
          recipientEmail: "recipient@example.com",
          subject: "Payment details needed",
          sentAt: "2026-03-31T18:00:00.000Z",
          metadata: { attempt: 2 },
        },
      ]);

    render(<QuoteActivity quoteId="q1" />);

    await waitFor(() => {
      expect(quoteApi.getViews).toHaveBeenCalledTimes(1);
      expect(quoteApi.getFollowUps).toHaveBeenCalledTimes(1);
      expect(screen.getByText("Activity")).toBeInTheDocument();
    });

    sseCallback?.();

    await waitFor(() => {
      expect(quoteApi.getViews).toHaveBeenCalledTimes(2);
      expect(quoteApi.getFollowUps).toHaveBeenCalledTimes(2);
      expect(screen.getByText(/follow-up/i)).toBeInTheDocument();
      expect(screen.getByText(/Attempt #2/)).toBeInTheDocument();
    });
  });

  it("surfaces load failures instead of hiding them as empty activity", async () => {
    vi.mocked(quoteApi.getViews).mockRejectedValueOnce(new Error("Forbidden"));
    vi.mocked(quoteApi.getFollowUps).mockResolvedValueOnce([]);

    render(<QuoteActivity quoteId="q1" />);

    await waitFor(() => {
      expect(screen.getByText("Activity")).toBeInTheDocument();
      expect(screen.getByText("Forbidden")).toBeInTheDocument();
    });
  });

  it("ignores stale activity results when a newer refresh resolves first", async () => {
    const firstViews = deferred<
      Array<{
        id: string;
        viewedAt: string;
        ipAddress: string | null;
        userAgent: string | null;
        referrer: string | null;
        viewport: string | null;
        durationSeconds: number | null;
        respondedWith: "ACCEPTED" | "DECLINED" | null;
      }>
    >();
    const firstFollowUps = deferred<
      Array<{
        id: string;
        type: string;
        recipientEmail: string;
        subject: string;
        sentAt: string;
        metadata: Record<string, unknown> | null;
      }>
    >();
    const secondViews = deferred<
      Array<{
        id: string;
        viewedAt: string;
        ipAddress: string | null;
        userAgent: string | null;
        referrer: string | null;
        viewport: string | null;
        durationSeconds: number | null;
        respondedWith: "ACCEPTED" | "DECLINED" | null;
      }>
    >();
    const secondFollowUps = deferred<
      Array<{
        id: string;
        type: string;
        recipientEmail: string;
        subject: string;
        sentAt: string;
        metadata: Record<string, unknown> | null;
      }>
    >();

    vi.mocked(quoteApi.getViews)
      .mockReturnValueOnce(firstViews.promise as never)
      .mockReturnValueOnce(secondViews.promise as never);
    vi.mocked(quoteApi.getFollowUps)
      .mockReturnValueOnce(firstFollowUps.promise as never)
      .mockReturnValueOnce(secondFollowUps.promise as never);

    render(<QuoteActivity quoteId="q1" />);

    await waitFor(() => {
      expect(quoteApi.getViews).toHaveBeenCalledTimes(1);
      expect(quoteApi.getFollowUps).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      sseCallback?.();
    });

    await waitFor(() => {
      expect(quoteApi.getViews).toHaveBeenCalledTimes(2);
      expect(quoteApi.getFollowUps).toHaveBeenCalledTimes(2);
    });

    secondViews.resolve([
      {
        id: "view-new",
        viewedAt: "2026-03-31T19:00:00.000Z",
        ipAddress: "2.2.2.2",
        userAgent: "Firefox",
        referrer: null,
        viewport: "1440x900",
        durationSeconds: 45,
        respondedWith: null,
      },
    ]);
    secondFollowUps.resolve([
      {
        id: "fu-new",
        type: "PAYMENT_REMINDER",
        recipientEmail: "recipient@example.com",
        subject: "Payment details needed",
        sentAt: "2026-03-31T20:00:00.000Z",
        metadata: { attempt: 2 },
      },
    ]);

    await waitFor(() => {
      expect(screen.getByText(/Attempt #2/)).toBeInTheDocument();
    });

    firstViews.resolve([
      {
        id: "view-old",
        viewedAt: "2026-03-31T18:00:00.000Z",
        ipAddress: "1.1.1.1",
        userAgent: "Chrome",
        referrer: null,
        viewport: "1200x800",
        durationSeconds: 5,
        respondedWith: null,
      },
    ]);
    firstFollowUps.resolve([]);

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText(/Attempt #2/)).toBeInTheDocument();
    expect(screen.queryByText(/Attempt #1/)).not.toBeInTheDocument();
  });
});
