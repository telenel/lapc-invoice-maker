import { beforeEach, describe, expect, it, vi } from "vitest";

const { getServerSessionMock, panelSpy } = vi.hoisted(() => ({
  getServerSessionMock: vi.fn(),
  panelSpy: vi.fn(),
}));

vi.mock("next-auth", () => ({
  getServerSession: getServerSessionMock,
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("@/components/admin/quick-pick-sections-panel", () => ({
  QuickPickSectionsPanel: (props: unknown) => {
    panelSpy(props);
    return null;
  },
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

beforeEach(() => {
  getServerSessionMock.mockReset();
  panelSpy.mockReset();
});

describe("AdminQuickPicksPage", () => {
  it("parses comma-separated SKUs from the query string and forwards them to the panel", async () => {
    getServerSessionMock.mockResolvedValue({
      user: { role: "admin" },
    });

    const { default: AdminQuickPicksPage } = await import("@/app/admin/quick-picks/page");

    const element = (await AdminQuickPicksPage({ searchParams: { skus: "202, 101,101,not-a-number" } })) as {
      props: { initialExplicitSkus: number[] };
    };

    expect(element.props.initialExplicitSkus).toEqual([101, 202]);
  });

  it("parses repeated SKU params from the query string and deduplicates them", async () => {
    getServerSessionMock.mockResolvedValue({
      user: { role: "admin" },
    });

    const { default: AdminQuickPicksPage } = await import("@/app/admin/quick-picks/page");

    const element = (await AdminQuickPicksPage({ searchParams: { skus: ["303, 202", "101", "202"] } })) as {
      props: { initialExplicitSkus: number[] };
    };

    expect(element.props.initialExplicitSkus).toEqual([101, 202, 303]);
  });
});
