"use client";

import { XIcon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import type { NotificationResponse } from "@/domains/notification/types";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

interface NotificationPanelProps {
  notifications: NotificationResponse[];
  unreadCount: number;
  onClose: () => void;
  onDismiss: (id: string) => void;
  onMarkAllRead: () => void;
  onNotificationClick: (
    notificationId: string,
    quoteId: string | null,
    invoiceId: string | null,
  ) => void;
}

export function NotificationPanel({
  notifications,
  unreadCount,
  onClose,
  onDismiss,
  onMarkAllRead,
  onNotificationClick,
}: NotificationPanelProps) {
  return (
    <AnimatePresence initial={false}>
      <motion.div
        className="absolute right-0 top-full z-50 mt-2 w-80 rounded-lg border border-border bg-popover shadow-lg"
        initial={{ opacity: 0, scale: 0.95, y: -8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -8 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
      >
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <span className="text-sm font-medium">Notifications</span>
          {unreadCount > 0 && (
            <button
              className="rounded text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Mark all notifications as read"
              onClick={onMarkAllRead}
            >
              Mark all as read
            </button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          <AnimatePresence initial={false}>
            {notifications.length === 0 ? (
              <p key="empty" className="px-3 py-6 text-center text-sm text-muted-foreground">
                No notifications
              </p>
            ) : (
              notifications.slice(0, 20).map((notification, index) => (
                <motion.div
                  key={notification.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 50, height: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className={cn(
                    "group relative flex items-start border-b border-border/50 last:border-0",
                    !notification.read && "bg-accent/60 dark:bg-accent/40",
                  )}
                >
                  <button
                    className="flex-1 px-3 py-2.5 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => {
                      onNotificationClick(
                        notification.id,
                        notification.quoteId,
                        notification.invoiceId,
                      );
                      onClose();
                    }}
                  >
                    <p className={cn("text-sm", !notification.read && "font-medium")}>
                      {notification.title}
                    </p>
                    {notification.message && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {notification.message}
                      </p>
                    )}
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {timeAgo(notification.createdAt)}
                    </p>
                  </button>
                  <button
                    className="mt-2 mr-2 shrink-0 rounded p-1 text-muted-foreground transition-opacity hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                    aria-label={`Dismiss notification: ${notification.title}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      onDismiss(notification.id);
                    }}
                  >
                    <XIcon className="size-3" aria-hidden="true" />
                  </button>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
