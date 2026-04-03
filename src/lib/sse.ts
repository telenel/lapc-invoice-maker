import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseAdminEnv } from "@/lib/supabase/env";
import {
  GLOBAL_REALTIME_TOPIC,
  REALTIME_BROADCAST_EVENT,
  getUserRealtimeTopic,
} from "./realtime-topics";

async function broadcast(topic: string, data: unknown): Promise<void> {
  try {
    if (!hasSupabaseAdminEnv()) return;
    const supabase = getSupabaseAdminClient();
    const channel = supabase.channel(topic, {
      config: { private: true },
    });

    const result = await channel.send({
      type: "broadcast",
      event: REALTIME_BROADCAST_EVENT,
      payload: data,
    });

    if (result !== "ok") {
      console.warn(`[realtime] broadcast to ${topic} returned ${result}`);
    }

    await supabase.removeChannel(channel);
  } catch (error) {
    console.error(`[realtime] broadcast to ${topic} failed:`, error);
  }
}

export function subscribe(): void {
  // Deprecated transport shim kept for the retired SSE endpoint.
}

export function unsubscribe(): void {
  // Deprecated transport shim kept for the retired SSE endpoint.
}

export function publish(userId: string, data: unknown): void {
  void broadcast(getUserRealtimeTopic(userId), data);
}

export function publishAll(data: unknown): void {
  void broadcast(GLOBAL_REALTIME_TOPIC, data);
}

export function safePublish(userId: string, data: unknown): void {
  try {
    publish(userId, data);
  } catch {
    /* Realtime broadcast failure is non-critical */
  }
}

export function safePublishAll(data: unknown): void {
  try {
    publishAll(data);
  } catch {
    /* Realtime broadcast failure is non-critical */
  }
}
