import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QuickPickSectionsPanel } from "@/components/admin/quick-pick-sections-panel";

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

    await waitFor(() => {
      expect(apiClientMocks.previewQuickPickSection).toHaveBeenCalledWith(
        expect.objectContaining({
          descriptionLike: "CT %",
        }),
      );
    });
  });
});
