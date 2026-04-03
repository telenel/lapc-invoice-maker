export const REALTIME_BROADCAST_EVENT = "message";
export const GLOBAL_REALTIME_TOPIC = "app:global";

export function getUserRealtimeTopic(userId: string): string {
  return `user:${userId}`;
}
