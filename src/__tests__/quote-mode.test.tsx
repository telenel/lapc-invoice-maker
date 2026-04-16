import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QuoteMode } from "@/components/quote/quote-mode";
import type { QuoteFormData } from "@/components/quote/quote-form";

vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: null }),
}));

vi.mock("@/lib/use-auto-save", () => ({
  useAutoSave: () => ({ clearDraft: vi.fn() }),
  loadDraft: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/domains/category/api-client", () => ({
  categoryApi: {
    list: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("@/domains/template/api-client", () => ({
  templateApi: {
    list: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
  },
}));

vi.mock("@/components/invoice/staff-select", () => ({
  StaffSelect: () => <div>staff select</div>,
}));

vi.mock("@/components/invoice/account-select", () => ({
  AccountSelect: () => <div>account select</div>,
}));

vi.mock("@/components/invoice/line-items", () => ({
  LineItems: () => <div>line items</div>,
}));

vi.mock("@/components/invoice/quick-pick-panel", () => ({
  QuickPickPanel: ({
    onSelect,
  }: {
    onSelect: (description: string, price: number) => void;
  }) => (
    <button type="button" onClick={() => onSelect("Shipping Fee", 42.5)}>
      Add Shipping Fee
    </button>
  ),
}));

vi.mock("@/components/quote/catering-details-card", () => ({
  CateringDetailsCard: () => <div>catering details</div>,
}));

vi.mock("@/components/ui/draft-recovery-banner", () => ({
  DraftRecoveryBanner: () => null,
}));

vi.mock("@/components/invoice/hooks/use-tax-calculation", () => ({
  useTaxCalculation: () => ({
    subtotal: 0,
    taxAmount: 0,
    total: 0,
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

function makeForm(overrides: Partial<QuoteFormData> = {}): QuoteFormData {
  return {
    date: "2026-04-12",
    staffId: "",
    department: "CopyTech",
    category: "",
    accountCode: "",
    accountNumber: "",
    approvalChain: [],
    contactName: "",
    contactExtension: "",
    contactEmail: "",
    contactPhone: "",
    notes: "",
    items: [
      {
        _key: "item-1",
        sku: null,
        description: "",
        quantity: 1,
        unitPrice: 0,
        extendedPrice: 0,
        sortOrder: 0,
        isTaxable: true,
        marginOverride: null,
        costPrice: null,
      },
      {
        _key: "item-2",
        sku: null,
        description: "Existing Item",
        quantity: 2,
        unitPrice: 10,
        extendedPrice: 20,
        sortOrder: 1,
        isTaxable: true,
        marginOverride: null,
        costPrice: null,
      },
    ],
    expirationDate: "2026-05-12",
    recipientName: "Jane Doe",
    recipientEmail: "jane@example.com",
    recipientOrg: "",
    marginEnabled: false,
    marginPercent: 0,
    taxEnabled: false,
    taxRate: 0.0975,
    isCateringEvent: false,
    cateringDetails: {
      eventDate: "2026-04-12",
      startTime: "",
      endTime: "",
      location: "",
      contactName: "",
      contactPhone: "",
      contactEmail: "",
      headcount: undefined,
      eventName: "",
      setupRequired: false,
      setupTime: "",
      setupInstructions: "",
      takedownRequired: false,
      takedownTime: "",
      takedownInstructions: "",
      specialInstructions: "",
    },
    ...overrides,
  };
}

describe("QuoteMode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("appends a new item for quick picks instead of replacing blank rows", async () => {
    const user = userEvent.setup();
    const updateField = vi.fn();
    const form = makeForm();

    render(
      <QuoteMode
        form={form}
        updateField={updateField}
        updateItem={vi.fn()}
        addItem={vi.fn()}
        removeItem={vi.fn()}
        total={20}
        itemsWithMargin={form.items}
        handleStaffSelect={vi.fn()}
        clearStaffSelection={vi.fn()}
        staffAccountNumbers={[]}
        saveQuote={vi.fn().mockResolvedValue(undefined)}
        saving={false}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Quick Picks" }));
    await user.click(screen.getByRole("button", { name: "Add Shipping Fee" }));

    expect(updateField).toHaveBeenCalledWith("items", [
      expect.objectContaining({ description: "" }),
      expect.objectContaining({ description: "Existing Item" }),
      expect.objectContaining({
        description: "Shipping Fee",
        quantity: 1,
        unitPrice: 42.5,
        extendedPrice: 42.5,
        sortOrder: 2,
      }),
    ]);
  });
});
