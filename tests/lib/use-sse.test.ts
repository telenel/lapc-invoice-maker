import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getSupabaseRealtimeContext = vi.fn();
const invalidateSupabaseRealtimeToken = vi.fn();

vi.mock("@/lib/supabase/browser", () => ({
  getSupabaseRealtimeContext,
  invalidateSupabaseRealtimeToken,
}));

type Status =
  | "SUBSCRIBED"
  | "TIMED_OUT"
  | "CHANNEL_ERROR"
  | "CLOSED";

type ChannelRecord = {
  topic: string;
  emitStatus: (status: Status) => void;
  emitPayload: (payload: unknown) => void;
};

function createMockRealtimeClient() {
  const channels: ChannelRecord[] = [];
  const removeChannel = vi.fn(async () => {});

  const client = {
    channel(topic: string) {
      let statusHandler: ((status: Status) => void) | undefined;
      let payloadHandler: ((payload: { payload: unknown }) => void) | undefined;

      const channel = {
        topic,
        on: vi.fn((_type: string, _filter: unknown, handler: (payload: { payload: unknown }) => void) => {
          payloadHandler = handler;
          return channel;
        }),
        subscribe: vi.fn((handler: (status: Status) => void) => {
          statusHandler = handler;
          return channel;
        }),
      };

      channels.push({
        topic,
        emitStatus: (status) => statusHandler?.(status),
        emitPayload: (payload) => payloadHandler?.({ payload }),
      });

      return channel;
    },
    removeChannel,
  };

  return { client, channels, removeChannel };
}

async function flushAsyncWork() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("subscribeToSSE", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("reconnects when a subscribed realtime channel errors", async () => {
    const first = createMockRealtimeClient();
    const second = createMockRealtimeClient();

    getSupabaseRealtimeContext
      .mockResolvedValueOnce({ client: first.client, userId: "user-1" })
      .mockResolvedValueOnce({ client: second.client, userId: "user-1" });

    const { subscribeToSSE } = await import("@/lib/use-sse");
    const listener = vi.fn();

    const unsubscribe = subscribeToSSE(listener);
    await flushAsyncWork();

    expect(first.channels.map((channel) => channel.topic)).toEqual(["app:global", "user:user-1"]);

    const firstGlobal = first.channels[0];
    const firstUser = first.channels[1];
    firstGlobal.emitStatus("SUBSCRIBED");
    firstUser.emitStatus("SUBSCRIBED");

    firstGlobal.emitPayload({ type: "invoice-changed" });
    expect(listener).toHaveBeenCalledWith({ type: "invoice-changed" });

    firstGlobal.emitStatus("CHANNEL_ERROR");
    expect(invalidateSupabaseRealtimeToken).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1000);
    await flushAsyncWork();

    expect(first.removeChannel).toHaveBeenCalledTimes(2);
    expect(getSupabaseRealtimeContext).toHaveBeenCalledTimes(2);
    expect(second.channels.map((channel) => channel.topic)).toEqual(["app:global", "user:user-1"]);

    second.channels[0].emitPayload({ type: "invoice-changed" });
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
  });
});
