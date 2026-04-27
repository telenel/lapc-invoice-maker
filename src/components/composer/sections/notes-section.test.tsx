import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { NotesSection } from "./notes-section";
import { useInvoiceForm } from "@/components/invoice/invoice-form";
import type { InvoiceFormData } from "@/components/invoice/invoice-form";

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

// Wrapper exercises the hook inside the component tree so state changes
// re-render the section like in production. Same pattern as
// items-pricing.test.tsx and document-details.test.tsx.
function Wrapper({ initial }: { initial?: Partial<InvoiceFormData> }) {
  const composer = useInvoiceForm(initial);
  return <NotesSection composer={composer} sectionStatus="default" />;
}

describe("NotesSection", () => {
  it("renders public + internal textareas with counter", () => {
    render(<Wrapper />);
    expect(
      screen.getByLabelText(/Notes \(visible on PDF\)/i),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Internal notes/i)).toBeInTheDocument();
    expect(screen.getByText(/0 \/ 500/)).toBeInTheDocument();
  });

  it("counter turns warn-tone at 480+", () => {
    render(<Wrapper initial={{ notes: "x".repeat(485) }} />);
    expect(screen.getByText(/485 \/ 500/)).toHaveClass("text-warn");
  });
});
