import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QuickPickSectionsPanel } from "@/components/admin/quick-pick-sections-panel";

async function pause(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

const { apiClientMocks } = vi.hoisted(() => ({
  apiClientMocks: {
    listQuickPickSections: vi.fn(),
    createQuickPickSection: vi.fn(),
    updateQuickPickSection: vi.fn(),
    deleteQuickPickSection: vi.fn(),
    previewQuickPickSection: vi.fn(),
  },
}));

vi.mock("@/domains/quick-pick-sections/api-client", () => ({
  quickPickSectionsApi: apiClientMocks,
}));

vi.mock("@/domains/product/vendor-directory", () => ({
  useProductRefDirectory: () => ({
    refs: {
      vendors: [],
      dccs: [],
      taxTypes: [],
      tagTypes: [],
      statusCodes: [],
      packageTypes: [],
      colors: [],
      bindings: [],
    },
    lookups: {
      vendorNames: new Map(),
      dccLabels: new Map(),
      taxTypeLabels: new Map(),
      tagTypeLabels: new Map(),
      statusCodeLabels: new Map(),
      packageTypeLabels: new Map(),
      colorLabels: new Map(),
      bindingLabels: new Map(),
    },
    vendors: [],
    byId: new Map(),
    loading: false,
    available: true,
  }),
}));

vi.mock("@/domains/product/views-api", () => ({
  loadDccList: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/domains/product/queries", () => ({
  searchProducts: vi.fn().mockResolvedValue({
    products: [],
    total: 0,
    page: 1,
    pageSize: 50,
  }),
}));

describe("QuickPickSectionsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiClientMocks.listQuickPickSections.mockResolvedValue([]);
    apiClientMocks.previewQuickPickSection.mockResolvedValue({
      isEmpty: false,
      productCount: 12,
      products: [],
    });
  });

  it("renders seeded sections that still use the Printer icon", async () => {
    apiClientMocks.listQuickPickSections.mockResolvedValue([
      {
        id: "section-1",
        name: "CopyTech Services",
        slug: "copytech-services",
        description: "In-house print shop services",
        icon: "Printer",
        sortOrder: 0,
        descriptionLike: "CT %",
        dccIds: [],
        vendorIds: [],
        itemType: null,
        explicitSkus: [],
        isGlobal: true,
        includeDiscontinued: false,
        productCount: 12,
        createdByUserId: null,
        createdAt: "2026-04-22T08:00:00.000Z",
        updatedAt: "2026-04-22T08:00:00.000Z",
        scopeSummary: "Description like CT %",
      },
    ]);

    render(<QuickPickSectionsPanel />);

    expect(await screen.findByText("CopyTech Services")).not.toBeNull();
  });

  it("shows the disabled empty-scope preview copy before any filters are configured", async () => {
    const user = userEvent.setup();

    render(<QuickPickSectionsPanel />);

    await waitFor(() => {
      expect(apiClientMocks.listQuickPickSections).toHaveBeenCalled();
    });

    await user.click(screen.getByRole("button", { name: /create section/i }));

    expect(
      screen.getByText("0 products match — chip will be disabled"),
    ).not.toBeNull();
    expect(apiClientMocks.previewQuickPickSection).not.toHaveBeenCalled();
  });

  it("refreshes the live preview when a scope field changes", async () => {
    const user = userEvent.setup();

    render(<QuickPickSectionsPanel />);

    await waitFor(() => {
      expect(apiClientMocks.listQuickPickSections).toHaveBeenCalled();
    });

    await user.click(screen.getByRole("button", { name: /create section/i }));
    await user.type(screen.getByLabelText(/name/i), "CopyTech Services");
    await user.type(screen.getByLabelText(/description like/i), "CT %");

    expect(apiClientMocks.previewQuickPickSection).not.toHaveBeenCalled();

    await pause(300);

    await waitFor(() => {
      expect(apiClientMocks.previewQuickPickSection).toHaveBeenCalledWith(
        expect.objectContaining({
          descriptionLike: "CT %",
        }),
      );
    });
  });

  it("does not refresh the preview when only non-scope fields change", async () => {
    const user = userEvent.setup();

    render(<QuickPickSectionsPanel />);

    await waitFor(() => {
      expect(apiClientMocks.listQuickPickSections).toHaveBeenCalled();
    });

    await user.click(screen.getByRole("button", { name: /create section/i }));
    await user.type(screen.getByLabelText(/description like/i), "CT %");
    await pause(300);

    await waitFor(() => {
      expect(apiClientMocks.previewQuickPickSection).toHaveBeenCalledTimes(1);
    });

    apiClientMocks.previewQuickPickSection.mockClear();

    await user.type(screen.getByLabelText(/name/i), "CopyTech Services");
    await pause(300);

    expect(apiClientMocks.previewQuickPickSection).not.toHaveBeenCalled();
  });

  it("keeps the edit dialog scrollable on short viewports", async () => {
    const user = userEvent.setup();

    render(<QuickPickSectionsPanel />);

    await waitFor(() => {
      expect(apiClientMocks.listQuickPickSections).toHaveBeenCalled();
    });

    await user.click(screen.getByRole("button", { name: /create section/i }));

    const dialogTitle = await screen.findByText(/create quick pick section/i);
    const dialogContent = dialogTitle.closest('[data-slot="dialog-content"]');

    expect(dialogContent).not.toBeNull();
    expect(dialogContent?.className).toContain("max-h-[90vh]");
    expect(dialogContent?.className).toContain("overflow-y-auto");
  });
});
