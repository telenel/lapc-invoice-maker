import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BulkEditFieldPreview } from "@/domains/bulk-edit/types";

const {
  bulkEditCommitMock,
  bulkEditDryRunMock,
  bulkEditFieldCommitMock,
  bulkEditFieldDryRunMock,
  listBulkEditRunsMock,
  refreshMock,
  refsDirectoryMock,
  toastSuccessMock,
} = vi.hoisted(() => ({
  bulkEditCommitMock: vi.fn(),
  bulkEditDryRunMock: vi.fn(),
  bulkEditFieldCommitMock: vi.fn(),
  bulkEditFieldDryRunMock: vi.fn(),
  listBulkEditRunsMock: vi.fn(),
  refreshMock: vi.fn(),
  refsDirectoryMock: vi.fn(),
  toastSuccessMock: vi.fn(),
}));

let searchParamsState = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock, push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => searchParamsState,
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children?: ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

vi.mock("@/domains/product/api-client", () => ({
  productApi: {
    bulkEditDryRun: bulkEditDryRunMock,
    bulkEditCommit: bulkEditCommitMock,
    bulkEditFieldDryRun: bulkEditFieldDryRunMock,
    bulkEditFieldCommit: bulkEditFieldCommitMock,
    listBulkEditRuns: listBulkEditRunsMock,
  },
}));

vi.mock("@/domains/product/vendor-directory", () => ({
  useProductRefDirectory: () => refsDirectoryMock(),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, render, ...props }: { children?: ReactNode; render?: ReactNode }) => {
    if (render) return <>{render}</>;
    return (
      <button type="button" {...props}>
        {children}
      </button>
    );
  },
}));

vi.mock("@/components/bulk-edit/bulk-edit-sidebar", () => ({
  BulkEditSidebar: () => <div data-testid="bulk-edit-sidebar" />,
}));

vi.mock("@/components/bulk-edit/audit-log-list", () => ({
  AuditLogList: () => <div data-testid="audit-log-list" />,
}));

vi.mock("@/components/bulk-edit/save-search-dialog", () => ({
  SaveSearchDialog: () => null,
}));

vi.mock("@/components/products/sync-database-button", () => ({
  SyncDatabaseButton: () => <div data-testid="sync-button" />,
}));

vi.mock("sonner", () => ({
  toast: {
    success: toastSuccessMock,
  },
}));

import BulkEditPage from "@/app/products/bulk-edit/page";

function makePreview(overrides: Partial<BulkEditFieldPreview> = {}): BulkEditFieldPreview {
  return {
    changedFieldLabels: ["Description", "Retail"],
    rows: [
      {
        sku: 101,
        description: "Old desc",
        changedFields: ["description", "retail"],
        cells: [
          {
            fieldId: "description",
            label: "Description",
            beforeLabel: "Old desc",
            afterLabel: "New desc",
            changed: true,
          },
          {
            fieldId: "retail",
            label: "Retail",
            beforeLabel: "2: 10",
            afterLabel: "2: 12.5",
            changed: true,
          },
        ],
        warnings: [],
      },
    ],
    totals: {
      rowCount: 1,
      changedFieldCount: 2,
    },
    warnings: [],
    ...overrides,
  };
}

describe("BulkEditPage Phase 8 field picker flow", () => {
  beforeEach(() => {
    searchParamsState = new URLSearchParams("preloadSkus=101,202");
    refreshMock.mockReset();
    bulkEditDryRunMock.mockReset();
    bulkEditCommitMock.mockReset();
    bulkEditFieldDryRunMock.mockReset();
    bulkEditFieldCommitMock.mockReset();
    listBulkEditRunsMock.mockResolvedValue({ items: [], total: 0 });
    toastSuccessMock.mockReset();
    refsDirectoryMock.mockReturnValue({
      refs: {
        vendors: [{ vendorId: 21, name: "Acme Books", pierceItems: 12 }],
        dccs: [{ dccId: 55, deptNum: 10, classNum: 20, catNum: 30, deptName: "Books", className: "Sci-Fi", catName: "Texts", pierceItems: 9 }],
        taxTypes: [{ taxTypeId: 6, description: "State Tax", pierceItems: 40 }],
        tagTypes: [{ tagTypeId: 7, label: "New Tag", subsystem: null, pierceRows: 14 }],
        statusCodes: [{ statusCodeId: 11, label: "Active", pierceRows: 10 }],
        packageTypes: [{ code: "EA", label: "Each", defaultQty: 1, pierceItems: 7 }],
        colors: [],
        bindings: [{ bindingId: 3, label: "Paperback", pierceBooks: 18 }],
      },
      loading: false,
      available: true,
      lookups: {
        vendorNames: new Map([[21, "Acme Books"]]),
        taxTypeLabels: new Map([[6, "State Tax"]]),
        tagTypeLabels: new Map([[7, "New Tag"]]),
        statusCodeLabels: new Map([[11, "Active"]]),
        packageTypeLabels: new Map([["EA", "Each"]]),
        colorLabels: new Map(),
        bindingLabels: new Map([[3, "Paperback"]]),
      },
      vendors: [{ vendorId: 21, name: "Acme Books", pierceItems: 12 }],
      byId: new Map([[21, "Acme Books"]]),
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("shows a searchable grouped field picker with fill-rate hints and a five-field cap", async () => {
    const user = userEvent.setup();

    render(<BulkEditPage />);

    const search = screen.getByRole("searchbox", { name: /search fields/i });
    await user.type(search, "cost");

    expect(screen.getByLabelText("Select Cost")).toBeInTheDocument();
    expect(screen.getByText(/96\.7% \/ 98\.4%/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Select Description")).not.toBeInTheDocument();

    await user.clear(search);

    await user.click(screen.getByLabelText("Select Description"));
    await user.click(screen.getByLabelText("Select Vendor"));
    await user.click(screen.getByLabelText("Select DCC"));
    await user.click(screen.getByLabelText("Select Barcode"));
    await user.click(screen.getByLabelText("Select Retail"));

    expect(screen.getByText("Selected 5 of 5 fields")).toBeInTheDocument();
    expect(screen.getByLabelText("Select Cost")).toBeDisabled();
  });

  it("renders matching value editors and inventory scope only when a location-aware field is selected", async () => {
    const user = userEvent.setup();

    render(<BulkEditPage />);

    await user.click(screen.getByLabelText("Select Description"));
    expect(screen.getByRole("textbox", { name: "Description" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Inventory scope")).not.toBeInTheDocument();

    await user.click(screen.getByLabelText("Select Retail"));
    expect(screen.getByRole("textbox", { name: "Description" })).toBeInTheDocument();
    expect(screen.getByRole("spinbutton", { name: "Retail" })).toBeInTheDocument();
    expect(screen.getByLabelText("Inventory scope")).toBeInTheDocument();
  });

  it("requires inventory scope before previewing a location-aware field edit", async () => {
    const user = userEvent.setup();

    render(<BulkEditPage />);

    await user.click(screen.getByLabelText("Select Retail"));

    expect(screen.getByLabelText("Inventory scope")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /preview/i })).toBeDisabled();

    await user.selectOptions(screen.getByLabelText("Inventory scope"), "all");

    expect(screen.getByRole("button", { name: /preview/i })).toBeEnabled();
  });

  it("previews and commits through the Phase 8 field-based client contract", async () => {
    const user = userEvent.setup();

    bulkEditFieldDryRunMock.mockResolvedValue(makePreview());
    bulkEditFieldCommitMock.mockResolvedValue({
      runId: "run_12345678",
      successCount: 1,
      affectedSkus: [101],
    });

    render(<BulkEditPage />);

    await user.click(screen.getByLabelText("Select Description"));
    await user.click(screen.getByLabelText("Select Retail"));
    await user.type(screen.getByRole("textbox", { name: "Description" }), "New desc");
    await user.clear(screen.getByRole("spinbutton", { name: "Retail" }));
    await user.type(screen.getByRole("spinbutton", { name: "Retail" }), "12.50");
    await user.selectOptions(screen.getByLabelText("Inventory scope"), "all");

    await user.click(screen.getByRole("button", { name: /preview/i }));

    await waitFor(() => {
      expect(bulkEditFieldDryRunMock).toHaveBeenCalledWith({
        selection: {
          scope: "pierce",
          skus: [101, 202],
        },
        transform: {
          fieldIds: ["description", "retail"],
          inventoryScope: "all",
          values: {
            description: "New desc",
            retail: "12.5",
          },
        },
      });
    });
    expect(bulkEditDryRunMock).not.toHaveBeenCalled();

    expect(screen.getByText("1 matching row")).toBeInTheDocument();
    expect(screen.getAllByText("2 field changes").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Description").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Retail").length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: /commit/i }));
    expect(screen.getByRole("heading", { name: "Apply 1 change?" })).toBeInTheDocument();
    expect(screen.getByText("Apply Description and Retail to 1 item.")).toBeInTheDocument();
    expect(screen.getByText("Review before committing. Changes are not undoable.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Apply Changes" }));

    await waitFor(() => {
      expect(bulkEditFieldCommitMock).toHaveBeenCalledWith({
        selection: {
          scope: "pierce",
          skus: [101, 202],
        },
        transform: {
          fieldIds: ["description", "retail"],
          inventoryScope: "all",
          values: {
            description: "New desc",
            retail: "12.5",
          },
        },
      });
    });
    expect(bulkEditCommitMock).not.toHaveBeenCalled();
    expect(refreshMock).toHaveBeenCalled();
    expect(toastSuccessMock).toHaveBeenCalledWith("Applied Description and Retail to 1 item.");
    expect(screen.getByRole("status")).toHaveTextContent("Applied Description and Retail to 1 item.");
  });
});
