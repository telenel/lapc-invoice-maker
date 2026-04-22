import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProductActionBar } from "./product-action-bar";

const pushMock = vi.fn();
let sessionRole: "admin" | "user" = "admin";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

vi.mock("next-auth/react", () => ({
  useSession: () => ({
    data: {
      user: {
        role: sessionRole,
      },
    },
  }),
}));

vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  },
}));

vi.mock("@/domains/product/vendor-directory", () => ({
  useVendorDirectory: () => ({
    byId: new Map<number, string>(),
  }),
}));

vi.mock("./barcode-print-view", () => ({
  openBarcodePrintWindow: vi.fn(),
}));

beforeEach(() => {
  pushMock.mockReset();
  sessionRole = "admin";
});

describe("ProductActionBar", () => {
  it("routes selected items to quick picks in ascending SKU order", async () => {
    const user = userEvent.setup();

    render(
      <ProductActionBar
        selected={
          new Map([
            [202, {
              sku: 202,
              description: "Second item",
              retailPrice: 24,
              cost: 12,
              barcode: null,
              author: null,
              title: null,
              isbn: null,
              edition: null,
              catalogNumber: null,
              vendorId: null,
              itemType: "general_merchandise",
            }],
            [101, {
              sku: 101,
              description: "First item",
              retailPrice: 18,
              cost: 9,
              barcode: null,
              author: null,
              title: null,
              isbn: null,
              edition: null,
              catalogNumber: null,
              vendorId: null,
              itemType: "general_merchandise",
            }],
          ])
        }
        selectedCount={2}
        onClear={vi.fn()}
        saveToSession={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Save to Quick Picks/i }));

    expect(pushMock).toHaveBeenCalledWith("/admin/quick-picks?skus=101%2C202");
  });

  it("hides Save to Quick Picks for non-admin users", () => {
    sessionRole = "user";

    render(
      <ProductActionBar
        selected={
          new Map([
            [101, {
              sku: 101,
              description: "Visible item",
              retailPrice: 18,
              cost: 9,
              barcode: null,
              author: null,
              title: null,
              isbn: null,
              edition: null,
              catalogNumber: null,
              vendorId: null,
              itemType: "general_merchandise",
            }],
          ])
        }
        selectedCount={1}
        onClear={vi.fn()}
        saveToSession={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: /Save to Quick Picks/i })).not.toBeInTheDocument();
  });

  it("shows a visible explanation when selected rows are missing pricing required for downstream actions", () => {
    render(
      <ProductActionBar
        selected={
          new Map([
            [101, {
              sku: 101,
              description: "Missing price item",
              retailPrice: null,
              cost: 12,
              barcode: null,
              author: null,
              title: null,
              isbn: null,
              edition: null,
              catalogNumber: null,
              vendorId: null,
              itemType: "general_merchandise",
            }],
            [102, {
              sku: 102,
              description: "Missing cost item",
              retailPrice: 24,
              cost: null,
              barcode: null,
              author: null,
              title: null,
              isbn: null,
              edition: null,
              catalogNumber: null,
              vendorId: null,
              itemType: "general_merchandise",
            }],
          ])
        }
        selectedCount={2}
        onClear={vi.fn()}
        saveToSession={vi.fn()}
        prismAvailable
        onEditClick={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: /Create Invoice/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Create Quote/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /^Edit$/i })).toBeDisabled();
    expect(
      screen.getByText(/1 selected item is missing retail price, so invoice and quote creation are unavailable/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/2 selected items are missing retail or cost, so edit is unavailable/i),
    ).toBeInTheDocument();
  });

  it("keeps edit available for a single-item v2 selection even when scoped pricing is blank", () => {
    render(
      <ProductActionBar
        selected={
          new Map([
            [101, {
              sku: 101,
              description: "Blank scoped pricing",
              retailPrice: null,
              cost: null,
              barcode: null,
              author: null,
              title: null,
              isbn: null,
              edition: null,
              catalogNumber: null,
              vendorId: null,
              itemType: "general_merchandise",
            }],
          ])
        }
        selectedCount={1}
        onClear={vi.fn()}
        saveToSession={vi.fn()}
        prismAvailable
        onEditClick={vi.fn()}
        allowMissingEditPricing
      />,
    );

    expect(screen.getByRole("button", { name: /^Edit$/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /Create Invoice/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Create Quote/i })).toBeDisabled();
    expect(screen.queryByText(/edit is unavailable/i)).not.toBeInTheDocument();
  });
});
