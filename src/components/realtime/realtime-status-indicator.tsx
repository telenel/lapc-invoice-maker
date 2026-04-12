"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useRealtimeConnectionStatus, type RealtimeConnectionState } from "@/lib/use-sse";

const realtimeStatusMeta: Record<
  RealtimeConnectionState,
  { label: string; variant: "outline" | "info" | "success" | "warning" | "destructive" }
> = {
  idle: { label: "Idle", variant: "outline" },
  connecting: { label: "Connect", variant: "info" },
  connected: { label: "Live", variant: "success" },
  reconnecting: { label: "Retry", variant: "warning" },
  disconnected: { label: "Off", variant: "destructive" },
};

function formatTimestamp(value: number | null) {
  if (!value) {
    return "never";
  }

  return new Date(value).toLocaleTimeString();
}

export function RealtimeStatusIndicator() {
  const snapshot = useRealtimeConnectionStatus();
  const meta = realtimeStatusMeta[snapshot.state];
  const titleParts = [
    `Realtime: ${meta.label}`,
    snapshot.attempt > 0 ? `attempt ${snapshot.attempt}` : null,
    snapshot.nextRetryAt ? `next retry ${formatTimestamp(snapshot.nextRetryAt)}` : null,
    snapshot.lastConnectedAt ? `last connected ${formatTimestamp(snapshot.lastConnectedAt)}` : null,
    snapshot.lastDisconnectedAt ? `last dropped ${formatTimestamp(snapshot.lastDisconnectedAt)}` : null,
  ].filter(Boolean);

  return (
    <Badge
      variant={meta.variant}
      title={titleParts.join(" | ")}
      aria-live="polite"
      className={cn(
        "hidden min-w-[52px] select-none items-center justify-center gap-1 px-1.5 text-[10px] sm:inline-flex",
        (snapshot.state === "connecting" || snapshot.state === "reconnecting") && "animate-pulse",
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" aria-hidden="true" />
      <span>{meta.label}</span>
      <span className="sr-only">
        {`Realtime ${meta.label}${snapshot.attempt > 0 ? ` attempt ${snapshot.attempt}` : ""}`}
      </span>
    </Badge>
  );
}
