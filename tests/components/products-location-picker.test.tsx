import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  LocationPicker,
  getNextProductLocationIds,
} from "@/components/products/location-picker";
import type { ProductLocationId } from "@/domains/product/location-filters";

function Harness({
  initialValue,
  onChange,
}: {
  initialValue: ProductLocationId[];
  onChange?: (next: ProductLocationId[]) => void;
}) {
  const [value, setValue] = useState<ProductLocationId[]>(initialValue);

  return (
    <LocationPicker
      value={value}
      onChange={(next) => {
        onChange?.(next);
        setValue(next);
      }}
    />
  );
}

describe("getNextProductLocationIds", () => {
  it("preserves canonical order when enabling a location", () => {
    expect(getNextProductLocationIds([3, 4], 2)).toEqual([2, 3, 4]);
    expect(getNextProductLocationIds([4, 2], 3)).toEqual([2, 3, 4]);
  });

  it("keeps the last selected location active", () => {
    expect(getNextProductLocationIds([4], 4)).toEqual([4]);
  });
});

describe("LocationPicker", () => {
  it("shows the segmented location filter in canonical order", () => {
    render(<Harness initialValue={[3, 4]} />);

    expect(screen.getByRole("group", { name: /location filter/i })).not.toBeNull();
    expect(screen.getByRole("button", { name: "PIER" }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByRole("button", { name: "PCOP" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "PFS" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("keeps the sole selected location from toggling off", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<Harness initialValue={[4]} onChange={onChange} />);

    const pfs = screen.getByRole("button", { name: "PFS" });
    expect(pfs.getAttribute("aria-pressed")).toBe("true");

    await user.click(pfs);

    expect(onChange).not.toHaveBeenCalled();
    expect(pfs.getAttribute("aria-pressed")).toBe("true");
  });
});
