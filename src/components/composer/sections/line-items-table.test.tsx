import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { LineItemsTable } from "./line-items-table";
import type { InvoiceItem } from "@/components/invoice/hooks/use-invoice-form-state";

function item(overrides: Partial<InvoiceItem> = {}): InvoiceItem {
  return {
    _key: "k",
    sku: null,
    description: "",
    quantity: 1,
    unitPrice: 0,
    extendedPrice: 0,
    sortOrder: 0,
    isTaxable: true,
    marginOverride: null,
    costPrice: null,
    ...overrides,
  };
}

describe("LineItemsTable", () => {
  it("renders one row per item with row number", () => {
    const items = [item({ _key: "a", description: "first" }), item({ _key: "b", description: "second" })];
    render(
      <LineItemsTable
        items={items}
        marginEnabled={false}
        taxEnabled={false}
        marginPercent={0}
        density="standard"
        onUpdate={vi.fn()}
        onRemove={vi.fn()}
      />
    );
    expect(screen.getByDisplayValue("first")).toBeInTheDocument();
    expect(screen.getByText("01")).toBeInTheDocument();
    expect(screen.getByText("02")).toBeInTheDocument();
  });

  it("uppercases description on change", async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn();
    render(
      <LineItemsTable
        items={[item({ _key: "a" })]}
        marginEnabled={false}
        taxEnabled={false}
        marginPercent={0}
        density="standard"
        onUpdate={onUpdate}
        onRemove={vi.fn()}
      />
    );
    await user.type(screen.getByLabelText(/Description row 1/i), "a");
    expect(onUpdate).toHaveBeenLastCalledWith(0, { description: "A" });
  });

  it("calls onRemove with index when trash clicked", async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    render(
      <LineItemsTable
        items={[item({ _key: "a", description: "x" })]}
        marginEnabled={false}
        taxEnabled={false}
        marginPercent={0}
        density="standard"
        onUpdate={vi.fn()}
        onRemove={onRemove}
      />
    );
    await user.click(screen.getByLabelText(/Remove row 1/i));
    expect(onRemove).toHaveBeenCalledWith(0);
  });
});

describe("LineItemsTable — margin enabled", () => {
  const items: InvoiceItem[] = [
    {
      _key: "a",
      sku: null,
      description: "x",
      quantity: 2,
      unitPrice: 10,
      extendedPrice: 20,
      sortOrder: 0,
      isTaxable: true,
      marginOverride: null,
      costPrice: 10,
    },
  ];

  it("renders Charged read-only as cost*(1+m/100)", () => {
    render(
      <LineItemsTable
        items={items}
        marginEnabled
        marginPercent={50}
        taxEnabled={false}
        density="standard"
        onUpdate={vi.fn()}
        onRemove={vi.fn()}
      />
    );
    expect(screen.getByText("15.00")).toBeInTheDocument();
  });
});
