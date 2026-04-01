import { render, screen, waitFor } from "@testing-library/react";
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
});
