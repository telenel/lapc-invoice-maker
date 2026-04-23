import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProductSearchPanel } from "./product-search-panel";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const { queriesMocks } = vi.hoisted(() => ({
  queriesMocks: {
    searchProducts: vi.fn(),
  },
}));

const { quickPickSectionMocks } = vi.hoisted(() => ({
  quickPickSectionMocks: {
    useQuickPickSections: vi.fn(),
  },
}));

vi.mock("@/domains/product/queries", () => ({
  searchProducts: queriesMocks.searchProducts,
}));

vi.mock("@/domains/quick-pick-sections", () => ({
  useQuickPickSections: quickPickSectionMocks.useQuickPickSections,
}));

function buildBrowseProducts() {
  return [
    {
      sku: 10000014,
      title: "Brave New World",
      description: null,
      retail_price: 135.55,
      cost: 90,
      barcode: null,
      author: "Huxley",
      isbn: "9780060850524",
      edition: "10",
      catalog_number: null,
      vendor_id: null,
      item_type: "textbook",
      product_type: null,
      stock_on_hand: 4,
      dcc_id: null,
      color_id: null,
      created_at: null,
      updated_at: "2026-04-20T00:00:00.000Z",
      last_sale_date: null,
      synced_at: "2026-04-20T00:00:00.000Z",
      dept_num: null,
      class_num: null,
      cat_num: null,
      dept_name: null,
      class_name: null,
      cat_name: null,
      units_sold_30d: 0,
      units_sold_90d: 0,
      units_sold_1y: 0,
      units_sold_3y: 0,
      units_sold_lifetime: 0,
      revenue_30d: 0,
      revenue_90d: 0,
      revenue_1y: 0,
      revenue_3y: 0,
      revenue_lifetime: 0,
      txns_1y: 0,
      txns_lifetime: 0,
      first_sale_date_computed: null,
      last_sale_date_computed: null,
      sales_aggregates_computed_at: null,
      effective_last_sale_date: null,
      aggregates_ready: true,
      edited_since_sync: false,
      margin_ratio: null,
      stock_coverage_days: null,
      trend_direction: null,
      discontinued: false,
      primary_location_id: 2,
      primary_location_abbrev: "PIER",
      selected_inventories: [],
      location_variance: {
        retailPriceVaries: false,
        costVaries: false,
        stockVaries: false,
        lastSaleDateVaries: false,
      },
    },
    {
      sku: 10000021,
      title: null,
      description: "SKU-only product",
      retail_price: 101.7,
      cost: 65,
      barcode: null,
      author: null,
      isbn: null,
      edition: null,
      catalog_number: null,
      vendor_id: null,
      item_type: "general_merchandise",
      product_type: null,
      stock_on_hand: 8,
      dcc_id: null,
      color_id: null,
      created_at: null,
      updated_at: "2026-04-20T00:00:00.000Z",
      last_sale_date: null,
      synced_at: "2026-04-20T00:00:00.000Z",
      dept_num: null,
      class_num: null,
      cat_num: null,
      dept_name: null,
      class_name: null,
      cat_name: null,
      units_sold_30d: 0,
      units_sold_90d: 0,
      units_sold_1y: 0,
      units_sold_3y: 0,
      units_sold_lifetime: 0,
      revenue_30d: 0,
      revenue_90d: 0,
      revenue_1y: 0,
      revenue_3y: 0,
      revenue_lifetime: 0,
      txns_1y: 0,
      txns_lifetime: 0,
      first_sale_date_computed: null,
      last_sale_date_computed: null,
      sales_aggregates_computed_at: null,
      effective_last_sale_date: null,
      aggregates_ready: true,
      edited_since_sync: false,
      margin_ratio: null,
      stock_coverage_days: null,
      trend_direction: null,
      discontinued: false,
      primary_location_id: 2,
      primary_location_abbrev: "PIER",
      selected_inventories: [],
      location_variance: {
        retailPriceVaries: false,
        costVaries: false,
        stockVaries: false,
        lastSaleDateVaries: false,
      },
    },
  ];
}

describe("ProductSearchPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    quickPickSectionMocks.useQuickPickSections.mockReturnValue({
      sections: [],
      loading: false,
      error: null,
    });
    queriesMocks.searchProducts.mockResolvedValue({
      total: 2,
      products: buildBrowseProducts(),
      page: 1,
      pageSize: 50,
    });
  });

  it("does not allow adding rows that are missing a retail price", async () => {
    const user = userEvent.setup();
    const onAddProducts = vi.fn();
    queriesMocks.searchProducts.mockResolvedValueOnce({
      total: 1,
      products: [
        {
          ...buildBrowseProducts()[0],
          sku: 10000099,
          title: "Missing price book",
          retail_price: null,
          cost: null,
        },
      ],
    });

    render(<ProductSearchPanel onAddProducts={onAddProducts} />);

    await waitFor(() => {
      expect(screen.getByText("MISSING PRICE BOOK")).toBeInTheDocument();
    });

    const checkbox = screen.getByRole("checkbox", { name: /Select SKU 10000099/i });
    const addButton = screen.getByRole("button", { name: /Select Products First/i });

    expect(checkbox).toHaveAttribute("aria-disabled", "true");
    expect(screen.getAllByText("Price unavailable")).not.toHaveLength(0);

    await user.click(screen.getByText("MISSING PRICE BOOK"));
    await user.click(addButton);

    expect(addButton).toBeDisabled();
    expect(onAddProducts).not.toHaveBeenCalled();
  });

  it("adds rows with a retail price while preserving null cost and vendor id", async () => {
    const user = userEvent.setup();
    const onAddProducts = vi.fn();
    queriesMocks.searchProducts.mockResolvedValueOnce({
      total: 1,
      products: [
        {
          ...buildBrowseProducts()[0],
          sku: 10000123,
          title: "NULL COST BOOK",
          retail_price: 48.5,
          cost: null,
          vendor_id: null,
        },
      ],
    });

    render(<ProductSearchPanel onAddProducts={onAddProducts} />);

    await waitFor(() => {
      expect(screen.getByText("NULL COST BOOK")).toBeInTheDocument();
    });

    await user.click(screen.getByText("NULL COST BOOK"));
    await user.click(screen.getByRole("button", { name: /Add 1 Selected/i }));

    expect(onAddProducts).toHaveBeenCalledWith([
      expect.objectContaining({
        sku: 10000123,
        retailPrice: 48.5,
        cost: null,
        vendorId: null,
      }),
    ]);
    expect(screen.getByText("1 product added to line items")).toBeInTheDocument();
  });

  it("reserves scroll clearance so the add button does not cover product rows", async () => {
    const { container } = render(<ProductSearchPanel onAddProducts={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("BRAVE NEW WORLD")).toBeInTheDocument();
    });

    const scrollRegion = container.querySelector("div.max-h-\\[500px\\].overflow-y-auto");
    const list = container.querySelector("ul.divide-y");
    const addButton = screen.getByRole("button", { name: /Select Products First/i });

    expect(scrollRegion).toHaveClass("scroll-pb-16");
    expect(list).toHaveClass("pb-16");
    expect(addButton.parentElement).toHaveClass("sticky", "bottom-0", "z-10");
  });

  it("switches to the Quick Picks tab and toggles between a section chip and All Quick Picks", async () => {
    const user = userEvent.setup();
    quickPickSectionMocks.useQuickPickSections.mockReturnValue({
      sections: [
        {
          id: "section-1",
          name: "CopyTech Services",
          slug: "copytech-services",
          description: null,
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
      ],
      loading: false,
      error: null,
    });

    render(<ProductSearchPanel onAddProducts={vi.fn()} />);

    await waitFor(() => {
      expect(queriesMocks.searchProducts).toHaveBeenLastCalledWith(
        expect.objectContaining({
          tab: "textbooks",
        }),
      );
    });

    await user.click(screen.getByRole("tab", { name: /Quick Picks/i }));

    await waitFor(() => {
      expect(queriesMocks.searchProducts).toHaveBeenLastCalledWith(
        expect.objectContaining({
          tab: "quickPicks",
          allSections: true,
          sectionSlug: undefined,
        }),
      );
    });

    await user.click(screen.getByRole("button", { name: /CopyTech Services/i }));

    await waitFor(() => {
      expect(queriesMocks.searchProducts).toHaveBeenLastCalledWith(
        expect.objectContaining({
          tab: "quickPicks",
          sectionSlug: "copytech-services",
          allSections: false,
        }),
      );
    });

    await user.click(screen.getByRole("button", { name: /CopyTech Services/i }));

    await waitFor(() => {
      expect(queriesMocks.searchProducts).toHaveBeenLastCalledWith(
        expect.objectContaining({
          tab: "quickPicks",
          sectionSlug: undefined,
          allSections: true,
        }),
      );
    });
  });

  it("composes free-text search with an active quick-pick section", async () => {
    const user = userEvent.setup();
    quickPickSectionMocks.useQuickPickSections.mockReturnValue({
      sections: [
        {
          id: "section-1",
          name: "CopyTech Services",
          slug: "copytech-services",
          description: null,
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
      ],
      loading: false,
      error: null,
    });

    render(<ProductSearchPanel onAddProducts={vi.fn()} />);

    await user.click(screen.getByRole("tab", { name: /Quick Picks/i }));
    await user.click(screen.getByRole("button", { name: /CopyTech Services/i }));
    await user.type(screen.getByPlaceholderText(/search products/i), "250");

    await waitFor(() => {
      expect(queriesMocks.searchProducts).toHaveBeenLastCalledWith(
        expect.objectContaining({
          tab: "quickPicks",
          sectionSlug: "copytech-services",
          search: "250",
        }),
      );
    });
  });

  it("supports keyboard navigation across quick-pick chips", async () => {
    const user = userEvent.setup();
    quickPickSectionMocks.useQuickPickSections.mockReturnValue({
      sections: [
        {
          id: "section-1",
          name: "CopyTech Services",
          slug: "copytech-services",
          description: null,
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
        {
          id: "section-2",
          name: "Empty Section",
          slug: "empty-section",
          description: null,
          icon: "Printer",
          sortOrder: 1,
          descriptionLike: null,
          dccIds: [],
          vendorIds: [],
          itemType: null,
          explicitSkus: [],
          isGlobal: true,
          includeDiscontinued: false,
          productCount: 0,
          createdByUserId: null,
          createdAt: "2026-04-22T08:00:00.000Z",
          updatedAt: "2026-04-22T08:00:00.000Z",
          scopeSummary: "No scope filters",
        },
      ],
      loading: false,
      error: null,
    });

    render(<ProductSearchPanel onAddProducts={vi.fn()} />);

    await user.click(screen.getByRole("tab", { name: /Quick Picks/i }));

    const allChip = screen.getByRole("button", { name: /All Quick Picks/i });
    allChip.focus();

    await user.keyboard("{ArrowRight}");

    const sectionChip = screen.getByRole("button", { name: /CopyTech Services/i });
    expect(sectionChip).toHaveFocus();

    await user.keyboard("{ArrowRight}");

    const disabledChip = screen.getByRole("button", { name: /Empty Section/i });
    expect(disabledChip).toHaveFocus();
    expect(disabledChip).toHaveAccessibleDescription("No filters set");

    await user.keyboard("{ArrowLeft}");
    expect(sectionChip).toHaveFocus();

    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(queriesMocks.searchProducts).toHaveBeenLastCalledWith(
        expect.objectContaining({
          sectionSlug: "copytech-services",
          allSections: false,
        }),
      );
    });

    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(queriesMocks.searchProducts).toHaveBeenLastCalledWith(
        expect.objectContaining({
          sectionSlug: undefined,
          allSections: true,
        }),
      );
    });
  });

  it("renders empty-scope sections as focusable disabled chips with a No filters set explanation", async () => {
    const user = userEvent.setup();
    quickPickSectionMocks.useQuickPickSections.mockReturnValue({
      sections: [
        {
          id: "section-2",
          name: "Empty Section",
          slug: "empty-section",
          description: null,
          icon: "Printer",
          sortOrder: 1,
          descriptionLike: null,
          dccIds: [],
          vendorIds: [],
          itemType: null,
          explicitSkus: [],
          isGlobal: true,
          includeDiscontinued: false,
          productCount: 0,
          createdByUserId: null,
          createdAt: "2026-04-22T08:00:00.000Z",
          updatedAt: "2026-04-22T08:00:00.000Z",
          scopeSummary: "No scope filters",
        },
      ],
      loading: false,
      error: null,
    });

    render(<ProductSearchPanel onAddProducts={vi.fn()} />);

    await user.click(screen.getByRole("tab", { name: /Quick Picks/i }));

    const tooltipTarget = screen.getByTitle("No filters set");
    const disabledChip = screen.getByRole("button", { name: /Empty Section/i });

    expect(tooltipTarget).toContainElement(disabledChip);
    expect(disabledChip).toHaveAttribute("aria-disabled", "true");
    expect(disabledChip).toHaveAccessibleDescription("No filters set");
  });
});
