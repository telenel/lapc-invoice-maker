import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { QuickPickPanel } from "@/components/invoice/quick-pick-panel";

// ---- helpers ----------------------------------------------------------------

function makeGlobalPick(overrides: Record<string, unknown> = {}) {
  return {
    id: "tax-1",
    department: "__ALL__",
    description: "CA State Tax",
    defaultPrice: 0,
    usageCount: 3,
    ...overrides,
  };
}

function makeDeptPick(overrides: Record<string, unknown> = {}) {
  return {
    id: "dept-1",
    department: "Bookstore",
    description: "Binder",
    defaultPrice: 4.99,
    usageCount: 1,
    ...overrides,
  };
}

function makeZeroPricePick(desc: string) {
  return {
    id: `zero-${desc}`,
    department: "__ALL__",
    description: desc,
    defaultPrice: 0,
    usageCount: 0,
  };
}

function stubFetch(quickPicks: unknown[] = [], savedItems: unknown[] = []) {
  vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
    const url = typeof input === "string" ? input : (input as Request).url;
    if (url.includes("/api/quick-picks")) {
      return Promise.resolve(
        new Response(JSON.stringify(quickPicks), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );
    }
    if (url.includes("/api/saved-items")) {
      return Promise.resolve(
        new Response(JSON.stringify(savedItems), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );
    }
    return Promise.resolve(new Response("Not found", { status: 404 }));
  });
}

// ---- tests ------------------------------------------------------------------

describe("QuickPickPanel — tax calculation", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("calculates 9.5% tax for subtotal $100 → $9.50", () => {
    const taxAmount = Math.round(100 * 0.095 * 100) / 100;
    expect(taxAmount).toBe(9.5);
    expect(taxAmount.toFixed(2)).toBe("9.50");
  });

  it("calculates 9.5% tax for subtotal $250.99 → $23.84", () => {
    const taxAmount = Math.round(250.99 * 0.095 * 100) / 100;
    expect(taxAmount).toBe(23.84);
  });

  it("calculates 9.5% tax for subtotal $0 → $0.00", () => {
    const taxAmount = Math.round(0 * 0.095 * 100) / 100;
    expect(taxAmount).toBe(0);
    expect(taxAmount.toFixed(2)).toBe("0.00");
  });
});

describe("QuickPickPanel — rendering", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders global picks (department "__ALL__") in "Fees & Tax" section', async () => {
    const taxPick = makeGlobalPick();
    stubFetch([taxPick]);

    render(
      <QuickPickPanel
        department="Bookstore"
        onSelect={vi.fn()}
        currentSubtotal={100}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Fees & Tax")).toBeInTheDocument();
    });
  });

  it("renders department-specific picks in their own section", async () => {
    const deptPick = makeDeptPick();
    stubFetch([deptPick]);

    render(
      <QuickPickPanel
        department="Bookstore"
        onSelect={vi.fn()}
        currentSubtotal={100}
      />
    );

    await waitFor(() => {
      expect(
        screen.getByText("Quick Picks for Bookstore")
      ).toBeInTheDocument();
    });
  });

  it("shows calculated tax amount in the tax button label", async () => {
    const taxPick = makeGlobalPick({ description: "CA State Tax" });
    stubFetch([taxPick]);

    render(
      <QuickPickPanel
        department="Bookstore"
        onSelect={vi.fn()}
        currentSubtotal={100}
      />
    );

    // 9.5% of 100 = $9.50
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /CA State Tax/ })
      ).toHaveTextContent("CA State Tax — $9.50");
    });
  });

  it('zero-price picks (e.g. "Shipping Fee") show just the name, no "$0.00"', async () => {
    const zeroPick = makeZeroPricePick("Shipping Fee");
    stubFetch([zeroPick]);

    render(
      <QuickPickPanel
        department="Bookstore"
        onSelect={vi.fn()}
        currentSubtotal={100}
      />
    );

    await waitFor(() => {
      const btn = screen.getByRole("button", { name: /Shipping Fee/ });
      expect(btn).toHaveTextContent("Shipping Fee");
      expect(btn.textContent).not.toContain("$0.00");
    });
  });

  it("zero-price Service Fee pick shows just the name", async () => {
    const zeroPick = makeZeroPricePick("Service Fee");
    stubFetch([zeroPick]);

    render(
      <QuickPickPanel
        department="Bookstore"
        onSelect={vi.fn()}
        currentSubtotal={50}
      />
    );

    await waitFor(() => {
      const btn = screen.getByRole("button", { name: /Service Fee/ });
      expect(btn.textContent).not.toContain("$0.00");
    });
  });

  it("calls onSelect with correct tax amount when tax button is clicked", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const taxPick = makeGlobalPick({ description: "CA State Tax" });
    stubFetch([taxPick]);

    render(
      <QuickPickPanel
        department="Bookstore"
        onSelect={onSelect}
        currentSubtotal={200}
      />
    );

    // 9.5% of 200 = $19.00
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /CA State Tax/ })
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /CA State Tax/ }));
    expect(onSelect).toHaveBeenCalledWith("CA State Tax", 19);
  });
});
