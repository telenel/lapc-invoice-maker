import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { replaceMock, signOutMock } = vi.hoisted(() => ({
  replaceMock: vi.fn(),
  signOutMock: vi.fn(),
}));

let pathnameState = "/";
let searchParamsState = new URLSearchParams();
let sessionState: {
  data: {
    user: {
      name: string;
      email: string;
      role: string;
    };
  } | null;
  status: "authenticated" | "unauthenticated" | "loading";
} = {
  data: {
    user: {
      name: "Admin User",
      email: "admin@example.com",
      role: "admin",
    },
  },
  status: "authenticated",
};

vi.mock("next/navigation", () => ({
  usePathname: () => pathnameState,
  useRouter: () => ({ replace: replaceMock, push: vi.fn() }),
  useSearchParams: () => searchParamsState,
}));

vi.mock("next-auth/react", () => ({
  useSession: () => sessionState,
  signOut: signOutMock,
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({
    theme: "light",
    setTheme: vi.fn(),
  }),
}));

vi.mock("next/dynamic", () => ({
  default: (loader: () => Promise<unknown>) => {
    const source = loader.toString();
    if (source.includes("help-modal")) {
      return function HelpModalStub() {
        return <button aria-label="Help">Help</button>;
      };
    }
    if (source.includes("notification-bell")) {
      return function NotificationBellStub() {
        return <div data-testid="notification-bell" />;
      };
    }
    return function DynamicStub() {
      return null;
    };
  },
}));

vi.mock("@/components/ui-scale-provider", () => ({
  useUIScale: () => ({
    scale: "1.1",
    setScale: vi.fn(),
    scales: [
      { value: "1", label: "Compact" },
      { value: "1.1", label: "Normal" },
      { value: "1.2", label: "Large" },
    ],
  }),
}));

vi.mock("@/components/realtime/realtime-status-indicator", () => ({
  RealtimeStatusIndicator: () => <div>Realtime Live</div>,
}));

vi.mock("@/components/admin/user-management", () => ({
  UserManagement: () => <div>users-panel</div>,
}));

vi.mock("@/components/admin/category-manager", () => ({
  CategoryManager: () => <div>categories-panel</div>,
}));

vi.mock("@/components/admin/invoice-manager", () => ({
  InvoiceManager: () => <div>invoices-panel</div>,
}));

vi.mock("@/components/admin/quote-manager", () => ({
  QuoteManager: () => <div>quotes-panel</div>,
}));

vi.mock("@/components/admin/line-item-manager", () => ({
  LineItemManager: () => <div>line-items-panel</div>,
}));

vi.mock("@/components/admin/db-health", () => ({
  DbHealth: () => <div>database-panel</div>,
}));

vi.mock("@/components/admin/account-code-manager", () => ({
  AccountCodeManager: () => <div>account-codes-panel</div>,
}));

vi.mock("@/components/admin/quote-contact-settings", () => ({
  QuoteContactSettings: () => <div>general-settings-panel</div>,
}));

vi.mock("@/components/ui/tabs", () => ({
  Tabs: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TabsList: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({ children }: { children: ReactNode }) => <button type="button">{children}</button>,
}));

import { Nav } from "@/components/nav";
import { SettingsPanel } from "@/components/admin/settings-panel";

describe("Nav cleanup", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    pathnameState = "/";
    searchParamsState = new URLSearchParams();
    sessionState = {
      data: {
        user: {
          name: "Admin User",
          email: "admin@example.com",
          role: "admin",
        },
      },
      status: "authenticated",
    };
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        buildSha: "be5aa2d",
        buildTime: "2026-04-13T07:11:25Z",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("keeps quick picks out of the top nav and removes help/live-status chrome", async () => {
    render(<Nav />);

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(screen.queryByRole("link", { name: "Quick Picks" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Help" })).not.toBeInTheDocument();
    expect(screen.queryByText("Realtime Live")).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows analytics in the nav for regular users too", async () => {
    sessionState = {
      data: {
        user: {
          name: "Regular User",
          email: "user@example.com",
          role: "user",
        },
      },
      status: "authenticated",
    };

    render(<Nav />);

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(screen.getByRole("link", { name: "Analytics" })).toBeInTheDocument();
  });
});

describe("Admin panel tabs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchParamsState = new URLSearchParams("tab=line-items");
  });

  afterEach(() => {
    cleanup();
  });

  it("drops quick picks from the admin panel tabs", () => {
    render(<SettingsPanel />);

    expect(screen.queryByRole("button", { name: "Quick Picks" })).not.toBeInTheDocument();
    expect(screen.getByText("line-items-panel")).toBeInTheDocument();
  });
});
