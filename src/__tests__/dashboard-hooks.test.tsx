import "@testing-library/jest-dom/vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const subscribeToSSE = vi.fn();
const getPreference = vi.fn();
const savePreference = vi.fn();
const clearPreference = vi.fn();

vi.mock("@/lib/use-sse", () => ({
  subscribeToSSE,
}));

vi.mock("@/domains/user-preference/api-client", () => ({
  userPreferenceApi: {
    get: getPreference,
    save: savePreference,
    clear: clearPreference,
  },
}));

import { useDeferredDashboardRealtime } from "@/components/dashboard/use-deferred-dashboard-realtime";
import { useDashboardOrder } from "@/components/dashboard/use-dashboard-order";

const DASHBOARD_ORDER_STORAGE_KEY = "laportal-dashboard-order";

function createDeferredPromise<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

function installLocalStorageMock() {
  const storage = new Map<string, string>();
  const localStorageMock = {
    getItem: vi.fn((key: string) => storage.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      storage.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      storage.delete(key);
    }),
    clear: vi.fn(() => {
      storage.clear();
    }),
  };

  vi.stubGlobal("localStorage", localStorageMock);
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: localStorageMock,
  });

  return localStorageMock;
}

async function flushAsyncWork() {
  await vi.dynamicImportSettled();
  await Promise.resolve();
  await Promise.resolve();
}

function DeferredRealtimeHarness({
  refresh,
  label,
}: {
  refresh: () => void;
  label: string;
}) {
  useDeferredDashboardRealtime(
    ["invoice-changed", "quote-changed"],
    refresh,
    { delayMs: 0, debounceMs: 25 },
  );

  return <div data-testid="deferred-label">{label}</div>;
}

function DashboardOrderHarness({
  defaultOrder,
  nextOrder,
}: {
  defaultOrder: string[];
  nextOrder: string[];
}) {
  const { order, setPersistedOrder } = useDashboardOrder(defaultOrder);

  return (
    <div>
      <div data-testid="dashboard-order">{order.join(",")}</div>
      <button type="button" onClick={() => setPersistedOrder(nextOrder)}>
        reorder
      </button>
    </div>
  );
}

describe("dashboard runtime hooks", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    installLocalStorageMock().removeItem(DASHBOARD_ORDER_STORAGE_KEY);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps the deferred realtime subscription stable across rerenders with identical event types", async () => {
    const unsubscribe = vi.fn();
    subscribeToSSE.mockReturnValue(unsubscribe);

    const refresh = vi.fn();
    const { rerender } = render(
      <DeferredRealtimeHarness refresh={refresh} label="first" />,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(subscribeToSSE).toHaveBeenCalledTimes(1);

    rerender(<DeferredRealtimeHarness refresh={refresh} label="second" />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(subscribeToSSE).toHaveBeenCalledTimes(1);
    expect(unsubscribe).not.toHaveBeenCalled();
  });

  it("refreshes once realtime connects so delayed widgets reconcile missed updates", async () => {
    const refresh = vi.fn();

    subscribeToSSE.mockImplementation((_listener, options) => {
      options?.onConnectionChange?.(true);
      return vi.fn();
    });

    render(<DeferredRealtimeHarness refresh={refresh} label="connected" />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(25);
    });

    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("still applies the stored server order when the user has not changed the layout yet", async () => {
    getPreference.mockResolvedValue({
      value: ["recent", "stats", "focus"],
    });

    render(
      <DashboardOrderHarness
        defaultOrder={["stats", "recent", "focus"]}
        nextOrder={["recent", "stats", "focus"]}
      />,
    );

    await act(async () => {
      await flushAsyncWork();
    });

    expect(screen.getByTestId("dashboard-order")).toHaveTextContent(
      "recent,stats,focus",
    );
  });

  it("does not overwrite a fresh local reorder with a stale server response", async () => {
    const pendingPreference = createDeferredPromise<{ value: string[] } | null>();

    getPreference.mockReturnValue(pendingPreference.promise);
    savePreference.mockResolvedValue({
      value: ["recent", "stats", "focus"],
    });

    render(
      <DashboardOrderHarness
        defaultOrder={["stats", "recent", "focus"]}
        nextOrder={["recent", "stats", "focus"]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "reorder" }));

    expect(screen.getByTestId("dashboard-order")).toHaveTextContent(
      "recent,stats,focus",
    );

    await act(async () => {
      pendingPreference.resolve({
        value: ["stats", "recent", "focus"],
      });
      await flushAsyncWork();
    });

    expect(screen.getByTestId("dashboard-order")).toHaveTextContent(
      "recent,stats,focus",
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    expect(savePreference).toHaveBeenCalledWith("laportal-dashboard-order", [
      "recent",
      "stats",
      "focus",
    ]);
  });
});
