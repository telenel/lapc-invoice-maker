import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  SyncPrismStatusPill,
  type SyncPrismStatusPillHandle,
} from "@/components/products/sync-prism-status-pill";

const { getSyncRunsMock, syncPrismPullMock } = vi.hoisted(() => ({
  getSyncRunsMock: vi.fn(),
  syncPrismPullMock: vi.fn(),
}));

vi.mock("@/domains/product/api-client", () => ({
  productApi: {
    getSyncRuns: getSyncRunsMock,
    syncPrismPull: syncPrismPullMock,
  },
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    disabled,
    ...rest
  }: {
    children?: ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    [key: string]: unknown;
  }) => (
    <button type="button" onClick={onClick} disabled={disabled} {...rest}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: { children: ReactNode }) => <div data-testid="popover-root">{children}</div>,
  PopoverTrigger: ({ render, children }: { render?: ReactNode; children?: ReactNode }) => (
    <div data-testid="popover-trigger">{render}{children}</div>
  ),
  PopoverContent: ({ children }: { children: ReactNode }) => (
    <div data-testid="popover-content">{children}</div>
  ),
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: ReactNode }) =>
    open ? <div data-testid="sync-history-dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

beforeEach(() => {
  vi.clearAllMocks();
  getSyncRunsMock.mockResolvedValue({
    runs: [
      {
        id: "run-1",
        startedAt: new Date(Date.now() - 90_000).toISOString(),
        completedAt: new Date(Date.now() - 60_000).toISOString(),
        triggeredBy: "scheduled",
        status: "ok",
        scannedCount: 10,
        updatedCount: 1,
        removedCount: 0,
        txnsAdded: 0,
        aggregatesUpdated: 0,
        error: null,
      },
    ],
  });
  syncPrismPullMock.mockResolvedValue({
    status: "ok",
    scanned: 10,
    updated: 1,
    removed: 0,
    durationMs: 200,
    txnsAdded: 0,
    aggregatesUpdated: 0,
    txnSyncDurationMs: 0,
    txnSyncError: null,
    txnSyncSkipped: null,
  });
});

afterEach(() => {
  cleanup();
});

describe("SyncPrismStatusPill", () => {
  it("renders Prism writability label and surfaces the latest sync age", async () => {
    render(<SyncPrismStatusPill prismAvailable={true} />);

    expect((await screen.findAllByText(/writable/i)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Sync/i).length).toBeGreaterThan(0);
    await waitFor(() => {
      expect(getSyncRunsMock).toHaveBeenCalled();
    });
  });

  it("shows read-only label when Prism is unreachable", async () => {
    render(<SyncPrismStatusPill prismAvailable={false} />);

    expect((await screen.findAllByText(/read-only/i)).length).toBeGreaterThan(0);
  });

  it("calls syncPrismPull when 'Sync now' is clicked", async () => {
    const user = userEvent.setup();
    render(<SyncPrismStatusPill prismAvailable={true} />);

    const syncButtons = await screen.findAllByRole("button", { name: /Sync now/i });
    await user.click(syncButtons[0]);

    await waitFor(() => {
      expect(syncPrismPullMock).toHaveBeenCalled();
    });
  });

  it("invokes onPrismRetry when Retry is clicked", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<SyncPrismStatusPill prismAvailable={false} onPrismRetry={onRetry} />);

    const retryButton = await screen.findByRole("button", { name: /Retry/i });
    await user.click(retryButton);

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("opens the sync history dialog when openHistory() is called via ref", async () => {
    const ref = createRef<SyncPrismStatusPillHandle>();
    render(<SyncPrismStatusPill ref={ref} prismAvailable={true} />);

    await waitFor(() => {
      expect(getSyncRunsMock).toHaveBeenCalled();
    });

    expect(screen.queryByTestId("sync-history-dialog")).not.toBeInTheDocument();

    ref.current?.openHistory();

    await waitFor(() => {
      expect(screen.getByTestId("sync-history-dialog")).toBeInTheDocument();
    });
  });
});
