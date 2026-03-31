import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useUrlFilters } from "@/lib/use-url-filters";

const replace = vi.fn();
const state = {
  pathname: "/invoices",
  search: "status=DRAFT&isRunning=true&sortBy=date&sortOrder=desc",
};

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => state.pathname,
  useSearchParams: () => new URLSearchParams(state.search),
}));

function Harness() {
  const { replaceFilters } = useUrlFilters({
    status: "",
    isRunning: "",
    sortBy: "date",
    sortOrder: "desc",
  });

  return (
    <button
      type="button"
      onClick={() => replaceFilters({ status: "FINAL", sortBy: "date", sortOrder: "desc" })}
    >
      Replace
    </button>
  );
}

describe("useUrlFilters", () => {
  beforeEach(() => {
    replace.mockClear();
  });

  it("can replace known filters so hidden params do not linger", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("button", { name: "Replace" }));

    expect(replace).toHaveBeenCalledWith("/invoices?status=FINAL", { scroll: false });
  });
});
