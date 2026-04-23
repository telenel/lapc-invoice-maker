import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
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

  it("prefills explicit SKUs from the initial handoff and opens the create dialog", async () => {
    render(<QuickPickSectionsPanel initialExplicitSkus={[302, 101]} />);

    expect(await screen.findByText("SKU 101")).toBeInTheDocument();
    expect(screen.getByText("SKU 302")).toBeInTheDocument();

    await pause(300);

    await waitFor(() => {
      expect(apiClientMocks.previewQuickPickSection).toHaveBeenCalledWith(
        expect.objectContaining({
          explicitSkus: [101, 302],
        }),
      );
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

  it("renders Any item type in a fresh create dialog instead of the raw sentinel", async () => {
    const user = userEvent.setup();

    render(<QuickPickSectionsPanel />);

    await waitFor(() => {
      expect(apiClientMocks.listQuickPickSections).toHaveBeenCalled();
    });

    await user.click(screen.getByRole("button", { name: /create section/i }));

    const itemTypeTrigger = screen.getByLabelText("Item type");
    expect(itemTypeTrigger).toHaveTextContent("Any item type");
    expect(itemTypeTrigger).not.toHaveTextContent("__any__");
  });

  it("keeps save disabled until the section has at least one real scope filter", async () => {
    const user = userEvent.setup();

    render(<QuickPickSectionsPanel />);

    await waitFor(() => {
      expect(apiClientMocks.listQuickPickSections).toHaveBeenCalled();
    });

    await user.click(screen.getByRole("button", { name: /create section/i }));
    await user.type(screen.getByLabelText(/name/i), "CopyTech Services");

    const dialog = screen.getByRole("dialog");
    const saveButton = within(dialog).getByRole("button", { name: /create section/i });
    expect(saveButton).toBeDisabled();

    await user.type(screen.getByLabelText(/description like/i), "CT %");

    expect(saveButton).not.toBeDisabled();
  });

  it("lets the availability label text toggle the checkbox state", async () => {
    const user = userEvent.setup();

    render(<QuickPickSectionsPanel />);

    await waitFor(() => {
      expect(apiClientMocks.listQuickPickSections).toHaveBeenCalled();
    });

    await user.click(screen.getByRole("button", { name: /create section/i }));

    const globalCheckbox = screen.getByRole("checkbox", { name: /global section/i });
    expect(globalCheckbox).toHaveAttribute("aria-checked", "true");

    await user.click(screen.getByText("Global section", { selector: "label" }));

    expect(globalCheckbox).toHaveAttribute("aria-checked", "false");
  });

  it("shows include discontinued as a modifier without enabling save by itself", async () => {
    const user = userEvent.setup();

    render(<QuickPickSectionsPanel />);

    await waitFor(() => {
      expect(apiClientMocks.listQuickPickSections).toHaveBeenCalled();
    });

    await user.click(screen.getByRole("button", { name: /create section/i }));
    await user.click(screen.getByText("Include discontinued products", { selector: "label" }));

    expect(screen.getByText("Availability modifier")).toBeInTheDocument();
    expect(screen.getByText("Includes discontinued")).toBeInTheDocument();
    expect(screen.getByText(/0 rules active/i)).toBeInTheDocument();
    expect(within(screen.getByRole("dialog")).getByRole("button", { name: /create section/i })).toBeDisabled();
  });

  it("allows editing legacy empty-scope sections without forcing a new scope rule", async () => {
    const user = userEvent.setup();

    const legacyEmptySection = {
      id: "section-empty",
      name: "Legacy Empty",
      slug: "legacy-empty",
      description: null,
      icon: "Package2",
      sortOrder: 0,
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
    };

    apiClientMocks.listQuickPickSections.mockResolvedValue([legacyEmptySection]);
    apiClientMocks.updateQuickPickSection.mockResolvedValue({
      ...legacyEmptySection,
      description: "Still legacy, now documented",
    });

    render(<QuickPickSectionsPanel />);

    expect(await screen.findByText("Legacy Empty")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /edit/i }));

    const saveButton = screen.getByRole("button", { name: /save changes/i });
    expect(saveButton).not.toBeDisabled();

    await user.type(screen.getByLabelText("Description"), "Still legacy, now documented");
    await user.click(saveButton);

    await waitFor(() => {
      expect(apiClientMocks.updateQuickPickSection).toHaveBeenCalledWith(
        "section-empty",
        expect.objectContaining({
          description: "Still legacy, now documented",
        }),
      );
    });
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

  it("widens the create dialog on desktop breakpoints", async () => {
    const user = userEvent.setup();

    render(<QuickPickSectionsPanel />);

    await waitFor(() => {
      expect(apiClientMocks.listQuickPickSections).toHaveBeenCalled();
    });

    await user.click(screen.getByRole("button", { name: /create section/i }));

    const dialogTitle = await screen.findByText(/create quick pick section/i);
    const dialogContent = dialogTitle.closest('[data-slot="dialog-content"]');

    expect(dialogContent).not.toBeNull();
    // The DialogContent primitive defaults to `sm:max-w-sm`. The Quick Picks
    // dialog must override that with a `sm:`-prefixed width larger than `sm`
    // (otherwise the desktop modal is clipped to ~384px).
    expect(dialogContent?.className).toMatch(/sm:max-w-(?:md|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|\[)/);

    // The two-column scope/preview layout should kick in by `lg:` so standard
    // laptops (1024px+) get the side-by-side experience, not just `xl:` (1280px+).
    const grid = dialogContent?.querySelector('[class*="grid-cols-"]');
    expect(grid).not.toBeNull();
    expect(grid?.className).toMatch(/lg:grid-cols-/);
  });
});
