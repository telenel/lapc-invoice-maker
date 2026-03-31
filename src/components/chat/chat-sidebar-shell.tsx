"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";

const ChatSidebar = dynamic(
  () => import("@/components/chat/chat-sidebar").then((m) => m.ChatSidebar),
  { ssr: false },
);

type IdleCapableWindow = Window & typeof globalThis & {
  requestIdleCallback?: (
    callback: IdleRequestCallback,
    options?: IdleRequestOptions,
  ) => number;
  cancelIdleCallback?: (handle: number) => void;
};

export function ChatSidebarShell() {
  const [shouldRender, setShouldRender] = useState(false);
  const handleRef = useRef<number | null>(null);

  useEffect(() => {
    const win = window as IdleCapableWindow;
    const media = window.matchMedia("(min-width: 1024px)");

    function clearScheduledLoad() {
      if (handleRef.current === null) return;

      if (win.cancelIdleCallback) {
        win.cancelIdleCallback(handleRef.current);
      } else {
        window.clearTimeout(handleRef.current);
      }

      handleRef.current = null;
    }

    function scheduleLoad() {
      if (shouldRender || !media.matches) return;
      clearScheduledLoad();

      if (win.requestIdleCallback) {
        handleRef.current = win.requestIdleCallback(() => {
          setShouldRender(true);
          handleRef.current = null;
        }, { timeout: 1500 });
        return;
      }

      handleRef.current = window.setTimeout(() => {
        setShouldRender(true);
        handleRef.current = null;
      }, 300);
    }

    scheduleLoad();

    function handleMediaChange(event: MediaQueryListEvent) {
      if (event.matches) {
        scheduleLoad();
      } else {
        clearScheduledLoad();
      }
    }

    media.addEventListener("change", handleMediaChange);

    return () => {
      media.removeEventListener("change", handleMediaChange);
      clearScheduledLoad();
    };
  }, [shouldRender]);

  if (!shouldRender) {
    return null;
  }

  return <ChatSidebar />;
}
