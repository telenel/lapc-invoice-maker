import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { InlineCombobox, type ComboboxItem } from "@/components/ui/inline-combobox";

const sampleItems: ComboboxItem[] = [
  { id: "1", label: "Alice Johnson", sublabel: "Math Dept", searchValue: "alice" },
  { id: "2", label: "Bob Smith", sublabel: "Science Dept", searchValue: "bob" },
  { id: "3", label: "Carol Williams", sublabel: "English Dept", searchValue: "carol" },
];

describe("InlineCombobox", () => {
  it("renders input with placeholder", () => {
    render(
      <InlineCombobox
        items={sampleItems}
        value=""
        onSelect={() => {}}
        placeholder="Select a person"
      />
    );
    const input = screen.getByRole("combobox");
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute("placeholder", "Select a person");
  });

  it("shows suggestions on focus", async () => {
    const user = userEvent.setup();
    render(
      <InlineCombobox items={sampleItems} value="" onSelect={() => {}} />
    );
    const input = screen.getByRole("combobox");
    await user.click(input);

    expect(screen.getByRole("listbox")).toBeInTheDocument();
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(3);
    expect(options[0]).toHaveTextContent("Alice Johnson");
    expect(options[1]).toHaveTextContent("Bob Smith");
    expect(options[2]).toHaveTextContent("Carol Williams");
  });

  it("filters suggestions as user types", async () => {
    const user = userEvent.setup();
    render(
      <InlineCombobox items={sampleItems} value="" onSelect={() => {}} />
    );
    const input = screen.getByRole("combobox");
    await user.click(input);
    await user.type(input, "bob");

    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent("Bob Smith");
  });

  it("calls onSelect and closes dropdown on Enter", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <InlineCombobox items={sampleItems} value="" onSelect={onSelect} />
    );
    const input = screen.getByRole("combobox");
    await user.click(input);

    // First item is auto-highlighted
    await user.keyboard("{Enter}");

    expect(onSelect).toHaveBeenCalledWith(sampleItems[0]);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("closes dropdown on Escape without selecting", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <InlineCombobox items={sampleItems} value="" onSelect={onSelect} />
    );
    const input = screen.getByRole("combobox");
    await user.click(input);

    expect(screen.getByRole("listbox")).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("navigates suggestions with arrow keys", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <InlineCombobox items={sampleItems} value="" onSelect={onSelect} />
    );
    const input = screen.getByRole("combobox");
    await user.click(input);

    const options = screen.getAllByRole("option");
    // First item is highlighted by default
    expect(options[0]).toHaveAttribute("aria-selected", "true");

    await user.keyboard("{ArrowDown}");
    expect(options[1]).toHaveAttribute("aria-selected", "true");
    expect(options[0]).toHaveAttribute("aria-selected", "false");

    await user.keyboard("{ArrowDown}");
    expect(options[2]).toHaveAttribute("aria-selected", "true");

    await user.keyboard("{ArrowUp}");
    expect(options[1]).toHaveAttribute("aria-selected", "true");

    // Select with Enter
    await user.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalledWith(sampleItems[1]);
  });

  it("displays displayValue when value is set", () => {
    render(
      <InlineCombobox
        items={sampleItems}
        value="1"
        displayValue="Alice Johnson"
        onSelect={() => {}}
      />
    );
    const input = screen.getByRole("combobox");
    expect(input).toHaveValue("Alice Johnson");
  });

  it("shows loading state", () => {
    render(
      <InlineCombobox
        items={[]}
        value=""
        onSelect={() => {}}
        loading={true}
        placeholder="Select a person"
      />
    );
    const input = screen.getByRole("combobox");
    expect(input).toBeDisabled();
    expect(input).toHaveAttribute("placeholder", "Loading\u2026");
  });

  it("allowCustom shows 'Add new:' option for unmatched input", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <InlineCombobox
        items={sampleItems}
        value=""
        onSelect={onSelect}
        allowCustom={true}
      />
    );
    const input = screen.getByRole("combobox");
    await user.click(input);
    await user.type(input, "Zara");

    const options = screen.getAllByRole("option");
    // No matches from items, only the custom entry
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent("Add new: Zara");

    // Select the custom entry
    await user.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        label: "Add new: Zara",
        isCustom: true,
      })
    );
  });
});
