import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LocationChipPopover } from "@/components/products/location-chip-popover";

vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ render, children }: { render?: ReactNode; children?: ReactNode }) => (
    <div>{render}{children}</div>
  ),
  PopoverContent: ({ children }: { children: ReactNode }) => (
    <div data-testid="loc-popover">{children}</div>
  ),
}));

afterEach(() => {
  cleanup();
});

describe("LocationChipPopover", () => {
  it("shows the primary location label when only one is selected", () => {
    render(<LocationChipPopover value={[2]} onChange={vi.fn()} />);
    // Pierce Main appears in both the trigger button and inside the popover
    // (since the test mock renders both unconditionally), so accept any match.
    expect(screen.getAllByRole("button", { name: /Pierce Main/i }).length).toBeGreaterThan(0);
  });

  it("shows '+N' suffix when multiple locations are selected", () => {
    render(<LocationChipPopover value={[2, 3, 4]} onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: /\+2/ })).toBeInTheDocument();
  });

  it("renders a checkbox per location inside the popover", () => {
    render(<LocationChipPopover value={[2]} onChange={vi.fn()} />);
    const popover = screen.getByTestId("loc-popover");
    expect(popover.textContent).toMatch(/PIER/);
    expect(popover.textContent).toMatch(/PCOP/);
    expect(popover.textContent).toMatch(/PFS/);
  });

  it("toggles a location on when its row is clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<LocationChipPopover value={[2]} onChange={onChange} />);

    // The PCOP row should be a clickable label/button — find it inside the popover.
    const popover = screen.getByTestId("loc-popover");
    const pcopRow = Array.from(popover.querySelectorAll("button, label"))
      .find((el) => el.textContent?.includes("PCOP"));
    expect(pcopRow).toBeTruthy();
    await user.click(pcopRow as HTMLElement);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).toEqual(expect.arrayContaining([2, 3]));
  });

  it("does not let the user remove the last selected location", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<LocationChipPopover value={[2]} onChange={onChange} />);

    const popover = screen.getByTestId("loc-popover");
    const pierRow = Array.from(popover.querySelectorAll("button, label"))
      .find((el) => el.textContent?.includes("PIER"));
    await user.click(pierRow as HTMLElement);

    // The picker forbids zero-selection because the table needs a primary
    // location; the click is a no-op.
    expect(onChange).not.toHaveBeenCalled();
  });
});
