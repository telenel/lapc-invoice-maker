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
import type { QuoteViewResponse } from "@/domains/quote/types";

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

export function QuoteActivity({ quoteId }: { quoteId: string }) {
  const [views, setViews] = useState<QuoteViewResponse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/quotes/${quoteId}/views`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setViews(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [quoteId]);

  if (loading) return null;
  if (views.length === 0) return null;

  const uniqueIPs = new Set(views.map((v) => v.ipAddress).filter(Boolean)).size;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Activity</span>
          <span className="text-sm font-normal text-muted-foreground">
            {views.length} view{views.length !== 1 ? "s" : ""} · {uniqueIPs} unique IP{uniqueIPs !== 1 ? "s" : ""}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>IP Address</TableHead>
              <TableHead>Browser</TableHead>
              <TableHead>Viewport</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Response</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {views.map((view) => (
              <TableRow key={view.id}>
                <TableCell className="text-sm">{formatDateTime(view.viewedAt)}</TableCell>
                <TableCell className="text-sm font-mono">{view.ipAddress ?? "\u2014"}</TableCell>
                <TableCell className="text-sm">{shortenUA(view.userAgent)}</TableCell>
                <TableCell className="text-sm font-mono">{view.viewport ?? "\u2014"}</TableCell>
                <TableCell className="text-sm">{formatDuration(view.durationSeconds)}</TableCell>
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
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
