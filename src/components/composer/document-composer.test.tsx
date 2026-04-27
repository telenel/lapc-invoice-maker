import "@testing-library/jest-dom/vitest";
import { act, render, renderHook, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: null, status: "unauthenticated" }),
}));

vi.mock("@/domains/user-draft/api-client", () => ({
  userDraftApi: {
    save: vi.fn().mockResolvedValue(undefined),
    get: vi.fn().mockResolvedValue(null),
    clear: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("@/components/invoice/staff-select", () => ({
  StaffSelect: ({ selectedId }: { selectedId?: string }) => (
    <div data-testid="staff-select">{selectedId ?? ""}</div>
  ),
}));
vi.mock("@/components/invoice/staff-summary-editor", () => ({
  StaffSummaryEditor: () => <div data-testid="staff-editor" />,
}));
vi.mock("@/components/invoice/account-number-select", () => ({
  AccountNumberSelect: ({ form }: { form: { accountNumber: string } }) => (
    <input data-testid="account-number" value={form.accountNumber} readOnly />
  ),
}));
vi.mock("@/domains/category/api-client", () => ({
  categoryApi: { list: vi.fn().mockResolvedValue([]) },
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

  it("renders real sections 1–3 (P3 wiring)", () => {
    const { result } = renderHook(() => useInvoiceForm());
    render(
      <DocumentComposer
        composer={{ docType: "invoice", form: result.current }}
        mode="create"
        status="DRAFT"
        canManageActions
      />,
    );
    // PeopleSection invoice variant — description text
    expect(screen.getByText(/Who is the requestor/i)).toBeInTheDocument();
    // DepartmentAccountSection — title
    expect(screen.getAllByText(/Department & Account/i).length).toBeGreaterThan(0);
    // DocumentDetailsSection — Running invoice switch (invoice variant)
    expect(screen.getByRole("switch", { name: /Running invoice/i })).toBeInTheDocument();
  });

  it("preview drawer shows charged price when margin is enabled", async () => {
    const { result } = renderHook(() => useInvoiceForm());
    act(() => {
      result.current.setForm((prev) => ({
        ...prev,
        marginEnabled: true,
        marginPercent: 50,
        items: [
          {
            ...prev.items[0],
            description: "WIDGET",
            quantity: 2,
            unitPrice: 10,
            costPrice: 10,
            extendedPrice: 30,
            isTaxable: false,
          },
        ],
      }));
    });

    render(
      <DocumentComposer
        composer={{ docType: "invoice", form: result.current }}
        mode="create"
        status="DRAFT"
        canManageActions
      />,
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /^Preview$/ }));

    const sheet = await screen.findByRole("dialog");
    const utils = within(sheet);
    // Charged unit price = cost 10 * (1 + 50/100) = 15. Extended at qty 2 = 30.
    // 30 appears three times (line extended, subtotal, grand total).
    expect(utils.getByText("$15.00")).toBeInTheDocument();
    expect(utils.getAllByText("$30.00").length).toBeGreaterThanOrEqual(1);
    // Cost basis must NOT leak into the preview when margin is on.
    expect(utils.queryByText("$10.00")).toBeNull();
    expect(utils.queryByText("$20.00")).toBeNull();
  });
});
