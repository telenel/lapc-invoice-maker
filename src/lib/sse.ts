import { hasSupabaseAdminEnv, getSupabaseAdminEnv } from "@/lib/supabase/env";
import {
  GLOBAL_REALTIME_TOPIC,
  REALTIME_BROADCAST_EVENT,
  getUserRealtimeTopic,
} from "./realtime-topics";

async function broadcast(topic: string, data: unknown): Promise<void> {
  try {
    if (!hasSupabaseAdminEnv()) return;
    const { url, serviceRoleKey } = getSupabaseAdminEnv();

    const response = await fetch(`${url}/rest/v1/rpc/broadcast`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
      },
      body: JSON.stringify({
        topic,
        event: REALTIME_BROADCAST_EVENT,
        payload: data,
        private: true,
      }),
    });

    if (!response.ok) {
      console.warn(`[realtime] broadcast to ${topic} returned ${response.status}`);
    }
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
