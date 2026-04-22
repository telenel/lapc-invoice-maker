import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { LineItems } from "@/components/invoice/line-items";

// Mock sonner toast so it doesn't fail in test environment
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// Mock InlineCombobox to render a simple input
vi.mock("@/components/ui/inline-combobox", () => ({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  InlineCombobox: ({ value, placeholder, onSelect, ...props }: Record<string, unknown>) => (
    <input
      data-testid="inline-combobox"
      value={value as string}
      placeholder={placeholder as string}
      onChange={() => {}}
      aria-label={props["aria-label"] as string || "combobox"}
      {...(props.className ? { className: props.className as string } : {})}
    />
  ),
}));

const defaultProps = {
  items: [
    {
      _key: "key-0",
      sku: null,
      description: "Test",
      quantity: 1,
      unitPrice: 10,
      extendedPrice: 10,
      sortOrder: 0,
      isTaxable: true,
      marginOverride: null,
      costPrice: null,
    },
  ],
  onUpdate: vi.fn(),
  onAdd: vi.fn(),
  onRemove: vi.fn(),
  total: 10,
};

describe("LineItems", () => {
  it("renders the correct number of rows based on items prop", () => {
    const items = [
      { _key: "key-0", sku: null, description: "Item A", quantity: 2, unitPrice: 5, extendedPrice: 10, sortOrder: 0, isTaxable: true, marginOverride: null, costPrice: null },
      { _key: "key-1", sku: null, description: "Item B", quantity: 1, unitPrice: 20, extendedPrice: 20, sortOrder: 1, isTaxable: true, marginOverride: null, costPrice: null },
      { _key: "key-2", sku: null, description: "Item C", quantity: 3, unitPrice: 7, extendedPrice: 21, sortOrder: 2, isTaxable: true, marginOverride: null, costPrice: null },
    ];

    render(<LineItems {...defaultProps} items={items} total={51} />);

    // Each row has a quantity aria-label like "Line item N quantity"
    const qtyInputs = screen.getAllByLabelText(/Line item \d+ quantity/);
    expect(qtyInputs).toHaveLength(3);
  });

  it("shows the total amount at the bottom", () => {
    render(<LineItems {...defaultProps} total={10} />);
    expect(screen.getByText("Total: $10.00")).toBeInTheDocument();
  });

  it("shows formatted total for larger amounts", () => {
    render(<LineItems {...defaultProps} total={1234.56} />);
    expect(screen.getByText("Total: $1234.56")).toBeInTheDocument();
  });

  it("calls onAdd when the + button is clicked", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    render(<LineItems {...defaultProps} onAdd={onAdd} />);

    const addBtn = screen.getByRole("button", { name: "Add line item" });
    await user.click(addBtn);
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it("calls onRemove when the X button is clicked", async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    const items = [
      { _key: "key-0", sku: null, description: "Item A", quantity: 1, unitPrice: 10, extendedPrice: 10, sortOrder: 0, isTaxable: true, marginOverride: null, costPrice: null },
      { _key: "key-1", sku: null, description: "Item B", quantity: 1, unitPrice: 20, extendedPrice: 20, sortOrder: 1, isTaxable: true, marginOverride: null, costPrice: null },
    ];

    render(
      <LineItems {...defaultProps} items={items} onRemove={onRemove} total={30} />
    );

    // Remove buttons: "Remove line item 1", "Remove line item 2"
    const removeBtn = screen.getByRole("button", { name: "Remove line item 2" });
    await user.click(removeBtn);
    expect(onRemove).toHaveBeenCalledWith(1);
  });

  it("remove button is disabled when only 1 item exists", () => {
    render(<LineItems {...defaultProps} />);

    const removeBtn = screen.getByRole("button", { name: "Remove line item 1" });
    expect(removeBtn).toBeDisabled();
  });

  it("does not render the removed save controls", () => {
    render(<LineItems {...defaultProps} />);

    expect(screen.queryByRole("button", { name: "Save to quick picks" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove from quick picks" })).not.toBeInTheDocument();
  });

  it("keeps the cost input readable when margin pricing is enabled", () => {
    render(
      <LineItems
        {...defaultProps}
        marginEnabled
        itemsWithMargin={[
          {
            ...defaultProps.items[0],
            extendedPrice: 12.5,
          },
        ]}
        total={12.5}
      />,
    );

    const costInput = screen.getByLabelText("Line item 1 unit price");
    expect(costInput).not.toHaveClass("line-through");
    expect(costInput).not.toHaveClass("text-muted-foreground");
    expect(screen.getByText("Cost")).toBeInTheDocument();
    expect(screen.getByLabelText("Line item 1 charged price")).toHaveTextContent("$12.50");
  });
});
