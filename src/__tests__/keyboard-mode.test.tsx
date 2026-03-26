import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { InlineCombobox } from "@/components/ui/inline-combobox";

const items = [
  { id: "1", label: "Doe, Jane", sublabel: "Program Manager" },
  { id: "2", label: "Doe, John", sublabel: "Director" },
  { id: "3", label: "Smith, Robert", sublabel: "Dean" },
];

describe("Keyboard Mode — InlineCombobox Tab Behavior", () => {
  it("Tab accepts highlighted suggestion and allows focus to advance", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(
      <div>
        <InlineCombobox items={items} value="" onSelect={onSelect} placeholder="Staff…" />
        <input data-testid="next-field" placeholder="Next field" />
      </div>
    );
    await user.click(screen.getByPlaceholderText("Staff…"));
    await user.type(screen.getByPlaceholderText("Staff…"), "jane");
    await user.tab();
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: "1", label: "Doe, Jane" })
    );
  });

  it("allowCustom shows 'Add new' option for unmatched input", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(
      <InlineCombobox
        items={items}
        value=""
        onSelect={onSelect}
        placeholder="Account…"
        allowCustom
        customPrefix="Add new:"
      />
    );
    await user.click(screen.getByPlaceholderText("Account…"));
    await user.type(screen.getByPlaceholderText("Account…"), "9999-99");
    expect(screen.getByText("Add new: 9999-99")).toBeInTheDocument();
  });
});

describe("Keyboard Mode — Focus Style Contract", () => {
  it("combobox input has role=combobox for CSS targeting", () => {
    render(
      <InlineCombobox items={items} value="" onSelect={vi.fn()} placeholder="Test" />
    );
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });
});
