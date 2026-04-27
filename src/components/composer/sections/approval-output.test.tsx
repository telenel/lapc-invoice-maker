import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ApprovalOutputSection } from "./approval-output";
import { useInvoiceForm } from "@/components/invoice/invoice-form";
import { useQuoteForm } from "@/components/quote/quote-form";

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
// `localStorage` to component effects — install a Map-backed mock so any
// downstream hook reaching for it doesn't crash. Same pattern as
// items-pricing.test.tsx.
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

interface InvoiceWrapperProps {
  attemptedSubmit?: boolean;
  canManageActions?: boolean;
  primaryDisabled?: boolean;
  canSaveDraft?: boolean;
}

// Wrapper exercises the hook inside the component tree so state changes
// re-render the section like in production. Same pattern as
// items-pricing.test.tsx and notes-section.test.tsx.
function InvoiceWrapper({
  attemptedSubmit = false,
  canManageActions = true,
  primaryDisabled = false,
  canSaveDraft = true,
}: InvoiceWrapperProps) {
  const composer = useInvoiceForm();
  return (
    <ApprovalOutputSection
      docType="invoice"
      composer={composer}
      sectionStatus="default"
      attemptedSubmit={attemptedSubmit}
      canManageActions={canManageActions}
      onOpenTemplates={() => {}}
      onPrimaryAction={() => {}}
      onSaveDraft={() => {}}
      onPrintRegister={() => {}}
      canSaveDraft={canSaveDraft}
      primaryDisabled={primaryDisabled}
    />
  );
}

function QuoteWrapper() {
  const composer = useQuoteForm();
  return (
    <ApprovalOutputSection
      docType="quote"
      composer={composer}
      sectionStatus="default"
      attemptedSubmit={false}
      canManageActions
      onOpenTemplates={() => {}}
      onPrimaryAction={() => {}}
      onSaveDraft={() => {}}
      onPrintRegister={() => {}}
      canSaveDraft
      primaryDisabled={false}
    />
  );
}

describe("ApprovalOutputSection (invoice)", () => {
  beforeEach(() => {
    installLocalStorageMock();
  });

  it("renders 3 approver slots", () => {
    render(<InvoiceWrapper />);
    expect(screen.getByText(/Signature 1/i)).toBeInTheDocument();
    expect(screen.getByText(/Signature 2/i)).toBeInTheDocument();
    expect(screen.getByText(/Signature 3/i)).toBeInTheDocument();
  });

  it("shows action toolbar with three groups", () => {
    render(<InvoiceWrapper />);
    expect(screen.getByRole("button", { name: /Generate PDF/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Save Draft/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Save as Template/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Print for Register/i })).toBeInTheDocument();
  });

  it("disables Generate PDF when primaryDisabled is true", () => {
    render(<InvoiceWrapper primaryDisabled />);
    expect(screen.getByRole("button", { name: /Generate PDF/i })).toBeDisabled();
  });
});

describe("ApprovalOutputSection (quote)", () => {
  beforeEach(() => {
    installLocalStorageMock();
  });

  it("hides approver grid + PrismCore", () => {
    render(<QuoteWrapper />);
    expect(screen.queryByText(/Signature 1/i)).toBeNull();
    expect(screen.queryByText(/PrismCore/i)).toBeNull();
    expect(
      screen.getByRole("button", { name: /Save Quote & Generate PDF/i }),
    ).toBeInTheDocument();
  });
});
