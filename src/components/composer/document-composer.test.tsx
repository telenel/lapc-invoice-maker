import "@testing-library/jest-dom/vitest";
import { render, renderHook, screen } from "@testing-library/react";
import { beforeEach, describe, it, expect, vi } from "vitest";

function installLocalStorageMock() {
  const storage = new Map<string, string>();
  const mock = {
    getItem: vi.fn((k: string) => storage.get(k) ?? null),
    setItem: vi.fn((k: string, v: string) => {
      storage.set(k, v);
    }),
    removeItem: vi.fn((k: string) => {
      storage.delete(k);
    }),
    clear: vi.fn(() => storage.clear()),
    key: vi.fn(),
    length: 0,
  };
  vi.stubGlobal("localStorage", mock);
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: mock,
  });
}

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

import { DocumentComposer } from "./document-composer";
import { useInvoiceForm } from "@/components/invoice/invoice-form";

describe("DocumentComposer shell", () => {
  beforeEach(() => {
    installLocalStorageMock();
  });

  it("renders header + 6 stub sections + rail", () => {
    const { result } = renderHook(() => useInvoiceForm());
    render(
      <DocumentComposer
        composer={{ docType: "invoice", form: result.current }}
        mode="create"
        status="DRAFT"
        canManageActions
      />,
    );
    expect(screen.getByText(/New Invoice/)).toBeInTheDocument();
    expect(screen.getAllByLabelText(/Step \d of 6/).length).toBe(6);
    expect(screen.getByText(/Readiness/i)).toBeInTheDocument();
  });
});
