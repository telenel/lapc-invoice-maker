"use client";

import { type ComponentType, useEffect, useRef, useState } from "react";
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
  return (
    <ResponsiveChatShell
      DesktopComponent={ChatSidebar}
      MobileComponent={ChatMobileLauncher}
    />
  );
}

interface ResponsiveChatShellProps {
  DesktopComponent: ComponentType;
  MobileComponent: ComponentType;
}

export function ResponsiveChatShell({
  DesktopComponent,
  MobileComponent,
}: ResponsiveChatShellProps) {
  const [shouldRenderDesktop, setShouldRenderDesktop] = useState(false);
  const [shouldRenderMobile, setShouldRenderMobile] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const handleRef = useRef<number | null>(null);

  useEffect(() => {
    const win = window as IdleCapableWindow;
    const media = window.matchMedia("(min-width: 1024px)");
    setIsDesktop(media.matches);

    function clearScheduledLoad() {
      if (handleRef.current === null) return;

      if (win.cancelIdleCallback) {
        win.cancelIdleCallback(handleRef.current);
      } else {
        window.clearTimeout(handleRef.current);
      }

      handleRef.current = null;
    }

    function scheduleLoad(nextIsDesktop = media.matches) {
      clearScheduledLoad();

      setIsDesktop(nextIsDesktop);

      if (nextIsDesktop && shouldRenderDesktop) return;
      if (!nextIsDesktop && shouldRenderMobile) return;

      if (win.requestIdleCallback) {
        handleRef.current = win.requestIdleCallback(
          () => {
            const currentIsDesktop = media.matches;
            setIsDesktop(currentIsDesktop);
            if (currentIsDesktop) {
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
        const currentIsDesktop = media.matches;
        setIsDesktop(currentIsDesktop);
        if (currentIsDesktop) {
          setShouldRenderDesktop(true);
        } else {
          setShouldRenderMobile(true);
        }
        handleRef.current = null;
      }, 300);
    }

    scheduleLoad();

    function handleMediaChange(event: MediaQueryListEvent) {
      scheduleLoad(event.matches);
    }

    media.addEventListener("change", handleMediaChange);

    return () => {
      media.removeEventListener("change", handleMediaChange);
      clearScheduledLoad();
    };
  }, [shouldRenderDesktop, shouldRenderMobile]);

  return (
    isDesktop
      ? shouldRenderDesktop
        ? <DesktopComponent />
        : null
      : shouldRenderMobile
        ? <MobileComponent />
        : null
  );
}
