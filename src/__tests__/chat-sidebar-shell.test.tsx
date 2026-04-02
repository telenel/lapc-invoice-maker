import "@testing-library/jest-dom/vitest";
import { act, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ResponsiveChatShell } from "@/components/chat/chat-sidebar-shell";

type MatchMediaChangeListener = (event: MediaQueryListEvent) => void;

function installMatchMedia(initialMatches: boolean) {
  const listeners = new Set<MatchMediaChangeListener>();
  const mediaQueryList = {
    matches: initialMatches,
    media: "(min-width: 1024px)",
    onchange: null,
    addEventListener: (_type: string, listener: MatchMediaChangeListener) => {
      listeners.add(listener);
    },
    removeEventListener: (_type: string, listener: MatchMediaChangeListener) => {
      listeners.delete(listener);
    },
    addListener: (listener: MatchMediaChangeListener) => {
      listeners.add(listener);
    },
    removeListener: (listener: MatchMediaChangeListener) => {
      listeners.delete(listener);
    },
    dispatchEvent: () => true,
  } satisfies MediaQueryList;

  vi.stubGlobal("matchMedia", vi.fn(() => mediaQueryList));

  return {
    setMatches(nextMatches: boolean) {
      mediaQueryList.matches = nextMatches;
      const event = {
        matches: nextMatches,
        media: mediaQueryList.media,
      } as MediaQueryListEvent;

      act(() => {
        for (const listener of listeners) {
          listener(event);
        }
      });
    },
  };
}

function DesktopComponent() {
  return <div data-testid="desktop-sidebar">desktop</div>;
}

function MobileComponent() {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return <div data-testid="mobile-launcher">mobile</div>;
}

describe("ResponsiveChatShell", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.style.overflow = "";
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("unmounts the mobile surface and restores body scroll after switching to desktop", () => {
    const media = installMatchMedia(false);

    render(
      <ResponsiveChatShell
        DesktopComponent={DesktopComponent}
        MobileComponent={MobileComponent}
      />,
    );

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(screen.getByTestId("mobile-launcher")).toBeInTheDocument();
    expect(document.body.style.overflow).toBe("hidden");

    media.setMatches(true);

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(screen.getByTestId("desktop-sidebar")).toBeInTheDocument();
    expect(screen.queryByTestId("mobile-launcher")).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe("");
  });
});
