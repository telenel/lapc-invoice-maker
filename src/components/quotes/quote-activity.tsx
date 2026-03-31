"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { QuoteViewResponse, QuoteFollowUpResponse } from "@/domains/quote/types";

type TimelineEntry =
  | { kind: "view"; data: QuoteViewResponse; date: string }
  | { kind: "followup"; data: QuoteFollowUpResponse; date: string };

function formatDuration(seconds: number | null): string {
  if (seconds == null) return "\u2014";
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function shortenUA(ua: string | null): string {
  if (!ua) return "\u2014";
  if (ua.includes("Chrome") && !ua.includes("Edg")) return "Chrome";
  if (ua.includes("Firefox")) return "Firefox";
  if (ua.includes("Safari") && !ua.includes("Chrome")) return "Safari";
  if (ua.includes("Edg")) return "Edge";
  return "Other";
}

function followUpLabel(type: string): string {
  switch (type) {
    case "PAYMENT_REMINDER": return "Payment Reminder";
    case "PAYMENT_RESOLVED": return "Payment Received";
    default: return type;
  }
}

function followUpVariant(type: string): "default" | "outline" | "secondary" {
  switch (type) {
    case "PAYMENT_RESOLVED": return "default";
    case "PAYMENT_REMINDER": return "outline";
    default: return "secondary";
  }
}

export function QuoteActivity({ quoteId }: { quoteId: string }) {
  const [views, setViews] = useState<QuoteViewResponse[]>([]);
  const [followUps, setFollowUps] = useState<QuoteFollowUpResponse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`/api/quotes/${quoteId}/views`).then((r) => (r.ok ? r.json() : [])),
      fetch(`/api/quotes/${quoteId}/follow-ups`).then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([v, f]) => { setViews(v); setFollowUps(f); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [quoteId]);

  if (loading) return null;
  if (views.length === 0 && followUps.length === 0) return null;

  // Build unified timeline
  const timeline: TimelineEntry[] = [
    ...views.map((v): TimelineEntry => ({ kind: "view", data: v, date: v.viewedAt })),
    ...followUps.map((f): TimelineEntry => ({ kind: "followup", data: f, date: f.sentAt })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const uniqueIPs = new Set(views.map((v) => v.ipAddress).filter(Boolean)).size;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Activity</span>
          <span className="text-sm font-normal text-muted-foreground">
            {views.length} view{views.length !== 1 ? "s" : ""}
            {uniqueIPs > 0 && <> · {uniqueIPs} unique IP{uniqueIPs !== 1 ? "s" : ""}</>}
            {followUps.length > 0 && <> · {followUps.length} follow-up{followUps.length !== 1 ? "s" : ""}</>}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Event</TableHead>
              <TableHead>Details</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {timeline.map((entry) => {
              if (entry.kind === "view") {
                const view = entry.data;
                return (
                  <TableRow key={`view-${view.id}`}>
                    <TableCell className="text-sm">{formatDateTime(view.viewedAt)}</TableCell>
                    <TableCell className="text-sm">Page View</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {shortenUA(view.userAgent)} · {view.viewport ?? "\u2014"} · {formatDuration(view.durationSeconds)}
                    </TableCell>
                    <TableCell>
                      {view.respondedWith ? (
                        <Badge variant={view.respondedWith === "ACCEPTED" ? "default" : "destructive"}>
                          {view.respondedWith === "ACCEPTED" ? "Approved" : "Declined"}
                        </Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">{"\u2014"}</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              }

              const fu = entry.data;
              const meta = fu.metadata as Record<string, unknown> | null;
              return (
                <TableRow key={`fu-${fu.id}`}>
                  <TableCell className="text-sm">{formatDateTime(fu.sentAt)}</TableCell>
                  <TableCell className="text-sm">
                    <Badge variant={followUpVariant(fu.type)}>{followUpLabel(fu.type)}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {fu.recipientEmail}
                    {meta?.attempt != null && <> · Attempt #{String(meta.attempt)}</>}
                    {meta?.paymentMethod != null && <> · {String(meta.paymentMethod)}</>}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">Sent</span>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
