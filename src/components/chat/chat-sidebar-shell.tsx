"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";

const ChatSidebar = dynamic(
  () => import("@/components/chat/chat-sidebar").then((m) => m.ChatSidebar),
  { ssr: false },
);

const ChatMobileLauncher = dynamic(
  () =>
    import("@/components/chat/chat-mobile-launcher").then(
      (m) => m.ChatMobileLauncher,
    ),
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
  const [shouldRenderDesktop, setShouldRenderDesktop] = useState(false);
  const [shouldRenderMobile, setShouldRenderMobile] = useState(false);
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
      clearScheduledLoad();

      const isDesktop = media.matches;

      if (isDesktop && shouldRenderDesktop) return;
      if (!isDesktop && shouldRenderMobile) return;

      if (win.requestIdleCallback) {
        handleRef.current = win.requestIdleCallback(
          () => {
            if (media.matches) {
              setShouldRenderDesktop(true);
            } else {
              setShouldRenderMobile(true);
            }
            handleRef.current = null;
          },
          { timeout: 1500 },
        );
        return;
      }

      handleRef.current = window.setTimeout(() => {
        if (media.matches) {
          setShouldRenderDesktop(true);
        } else {
          setShouldRenderMobile(true);
        }
        handleRef.current = null;
      }, 300);
    }

    scheduleLoad();

    function handleMediaChange() {
      scheduleLoad();
    }

    media.addEventListener("change", handleMediaChange);

    return () => {
      media.removeEventListener("change", handleMediaChange);
      clearScheduledLoad();
    };
  }, [shouldRenderDesktop, shouldRenderMobile]);

  return (
    <>
      {shouldRenderDesktop && <ChatSidebar />}
      {shouldRenderMobile && <ChatMobileLauncher />}
    </>
  );
}
