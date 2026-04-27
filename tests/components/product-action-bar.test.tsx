import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import type React from "react";
import { describe, expect, it, vi } from "vitest";
import { ProductActionBar } from "@/components/products/product-action-bar";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: { user: { role: "staff" } } }),
}));

vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div {...props}>{children}</div>
    ),
  },
}));

vi.mock("@/domains/product/vendor-directory", () => ({
  useVendorDirectory: () => ({
    byId: new Map<number, string>(),
  }),
}));

vi.mock("@/domains/product/api-client", () => ({
  productApi: {
    discontinue: vi.fn(),
  },
}));

vi.mock("@/components/products/barcode-print-view", () => ({
  openBarcodePrintWindow: vi.fn(),
}));

describe("ProductActionBar", () => {
  it("makes off-page selections explicit", () => {
    render(
      <ProductActionBar
        selected={
          new Map([
            [
              101,
              {
                sku: 101,
                description: "Notebook",
                retailPrice: 4.99,
                cost: 2.5,
                pricingLocationId: 2,
                barcode: null,
                author: null,
                title: null,
                isbn: null,
                edition: null,
                catalogNumber: null,
                vendorId: null,
                itemType: "general_merchandise",
              },
            ],
          ])
        }
        selectedCount={1}
        visibleSelectedCount={0}
        offPageSelectedCount={1}
        onClear={vi.fn()}
        saveToSession={vi.fn()}
      />,
    );

    expect(screen.getByText("1 item selected")).toBeInTheDocument();
    expect(
      screen.getByText((_, node) => {
        const text = node?.textContent?.replace(/\s+/g, " ").trim() ?? "";
        return text.startsWith("0 on this page · 1 on other pages");
      }),
    ).toBeInTheDocument();
  });
});
