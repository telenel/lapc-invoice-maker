import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ItemsAndPricingSection } from "./items-pricing";
import { useInvoiceForm } from "@/components/invoice/invoice-form";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/invoices/new",
}));

// jsdom in this project's vitest config does not always provide a working
// `localStorage` to component effects — the useDensity hook reads from it on
// mount. Install a Map-backed mock so the section's effect doesn't crash.
function installLocalStorageMock() {
  const storage = new Map<string, string>();
  const mock = {
    getItem: vi.fn((key: string) => storage.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      storage.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      storage.delete(key);
    }),
    clear: vi.fn(() => {
      storage.clear();
    }),
    key: vi.fn(),
    length: 0,
  };
  vi.stubGlobal("localStorage", mock);
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: mock,
  });
}

// Wrapper exercises the hook inside the component tree so state changes
// re-render the section like in production.
function InvoiceWrapper({ onOpenCatalog }: { onOpenCatalog: () => void }) {
  const composer = useInvoiceForm();
  return (
    <ItemsAndPricingSection
      composer={composer}
      sectionStatus="default"
      onOpenCatalog={onOpenCatalog}
    />
  );
}

describe("ItemsAndPricingSection", () => {
  beforeEach(() => {
    installLocalStorageMock();
  });

  it("renders table + density toggle + add-custom button + margin/tax cards", () => {
    render(<InvoiceWrapper onOpenCatalog={vi.fn()} />);
    expect(screen.getByRole("radiogroup", { name: /Density/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Search Product Catalog/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Add custom line/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Margin")).toBeInTheDocument();
    expect(screen.getByText("Sales tax")).toBeInTheDocument();
  });
});
