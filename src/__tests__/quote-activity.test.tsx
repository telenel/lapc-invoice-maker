import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { QuoteActivity } from "@/components/quotes/quote-activity";

let sseCallback: (() => void) | undefined;

vi.mock("@/lib/use-sse", () => ({
  useSSE: vi.fn((_eventType: string, callback: () => void) => {
    sseCallback = callback;
  }),
}));

describe("QuoteActivity", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    sseCallback = undefined;
  });

  it("refetches activity when a quote-changed SSE event arrives", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify([
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
        ]), { status: 200, headers: { "Content-Type": "application/json" } }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify([
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
        ]), { status: 200, headers: { "Content-Type": "application/json" } }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify([
          {
            id: "fu-1",
            type: "PAYMENT_REMINDER",
            recipientEmail: "recipient@example.com",
            subject: "Payment details needed",
            sentAt: "2026-03-31T18:00:00.000Z",
            metadata: { attempt: 2 },
          },
        ]), { status: 200, headers: { "Content-Type": "application/json" } }),
      );

    render(<QuoteActivity quoteId="q1" />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(screen.getByText("Activity")).toBeInTheDocument();
    });

    sseCallback?.();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(4);
      expect(screen.getByText(/follow-up/i)).toBeInTheDocument();
      expect(screen.getByText(/Attempt #2/)).toBeInTheDocument();
    });
  });
});
