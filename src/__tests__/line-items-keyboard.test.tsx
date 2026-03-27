import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { LineItems } from "@/components/invoice/line-items";

// Mock sonner toast so it doesn't fail in test environment
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// Mock lucide-react Bookmark icon
vi.mock("lucide-react", () => ({
  Bookmark: (props: Record<string, unknown>) => <svg data-testid="bookmark-icon" {...props} />,
}));

const defaultProps = {
  items: [
    {
      description: "Test",
      quantity: 1,
      unitPrice: 10,
      extendedPrice: 10,
      sortOrder: 0,
    },
  ],
  onUpdate: vi.fn(),
  onAdd: vi.fn(),
  onRemove: vi.fn(),
  total: 10,
  department: "Test Dept",
};

describe("LineItems", () => {
  it("renders the correct number of rows based on items prop", () => {
    const items = [
      { description: "Item A", quantity: 2, unitPrice: 5, extendedPrice: 10, sortOrder: 0 },
      { description: "Item B", quantity: 1, unitPrice: 20, extendedPrice: 20, sortOrder: 1 },
      { description: "Item C", quantity: 3, unitPrice: 7, extendedPrice: 21, sortOrder: 2 },
    ];

    render(<LineItems {...defaultProps} items={items} total={51} />);

    // Each row has a description aria-label like "Line item N description"
    const descInputs = screen.getAllByLabelText(/Line item \d+ description/);
    expect(descInputs).toHaveLength(3);
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
      { description: "Item A", quantity: 1, unitPrice: 10, extendedPrice: 10, sortOrder: 0 },
      { description: "Item B", quantity: 1, unitPrice: 20, extendedPrice: 20, sortOrder: 1 },
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
});
