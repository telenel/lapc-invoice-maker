"use client";

import { useState, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { BellIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNotifications } from "@/domains/notification/hooks";

const NotificationPanel = dynamic(
  () =>
    import("@/components/notifications/notification-panel").then(
      (m) => m.NotificationPanel,
    ),
  { ssr: false },
);

export function NotificationBell() {
  const router = useRouter();
  const { notifications, unreadCount, markRead, markAllRead, dismiss } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function handleNotificationClick(notificationId: string, quoteId: string | null, invoiceId: string | null) {
    markRead(notificationId);
    setOpen(false);
    if (invoiceId) {
      router.push(`/invoices/${invoiceId}`);
    } else if (quoteId) {
      router.push(`/quotes/${quoteId}`);
    }
  }

  return (
    <div className="relative" ref={ref}>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Notifications"
        onClick={() => setOpen(!open)}
      >
        <BellIcon className="size-4" aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[16px] h-4 px-1 text-[10px] font-bold text-white bg-red-500 rounded-full">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </Button>

      {open ? (
        <NotificationPanel
          notifications={notifications}
          unreadCount={unreadCount}
          onClose={() => setOpen(false)}
          onDismiss={(notificationId) => {
            dismiss(notificationId).catch(() => {
              // already handled by the notifications hook
            });
          }}
          onMarkAllRead={() => {
            markAllRead().catch(() => {
              // already handled by the notifications hook
            });
          }}
          onNotificationClick={handleNotificationClick}
        />
      ) : null}
    </div>
  );
}
