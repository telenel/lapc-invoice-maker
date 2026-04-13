import { beforeEach, describe, expect, it, vi } from "vitest";
import { getServerSession } from "next-auth";
import QuickPicksPage from "@/app/quick-picks/page";

const { redirectMock } = vi.hoisted(() => ({
  redirectMock: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    quickPickItem: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/components/quick-picks/quick-pick-table", () => ({
  QuickPickTable: () => null,
}));

describe("QuickPicksPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects admins into the admin settings quick picks tab", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "admin-1", role: "admin" },
    } as never);

    await expect(QuickPicksPage()).rejects.toThrow("REDIRECT:/admin/settings?tab=quick-picks");
  });

  it("still redirects non-admin users away from the page", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user-1", role: "user" },
    } as never);

    await expect(QuickPicksPage()).rejects.toThrow("REDIRECT:/");
  });
});
