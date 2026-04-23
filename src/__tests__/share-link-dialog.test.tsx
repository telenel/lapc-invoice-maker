import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ShareLinkDialog } from "@/components/quotes/share-link-dialog";

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe("ShareLinkDialog", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url === "/api/email/status") {
          return {
            ok: true,
            json: async () => ({ available: true }),
          };
        }
        if (url === "/api/email/send") {
          return {
            ok: true,
            status: 202,
            statusText: "Accepted",
            json: async () => ({ recipient: "jane@example.com" }),
          };
        }
        if (url === "/api/quotes/q1/mark-submitted") {
          return {
            ok: true,
            json: async () => ({}),
          };
        }
        throw new Error(`Unexpected fetch: ${url}`);
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("auto-closes after a share email is queued successfully", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    render(
      <ShareLinkDialog
        open
        onOpenChange={onOpenChange}
        shareUrl="https://example.test/quotes/public/token"
        quoteNumber="Q-1"
        recipientEmail="jane@example.com"
        recipientName="Jane"
        quoteId="q1"
        quoteStatus="SENT"
      />,
    );

    await user.click(await screen.findByRole("button", { name: /send email/i }));

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    }, { timeout: 3_000 });
  });
});
