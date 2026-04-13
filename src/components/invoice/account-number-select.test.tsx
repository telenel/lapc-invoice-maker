import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { AccountNumberSelect } from "./account-number-select";
import type { InvoiceFormData, StaffAccountNumber } from "./invoice-form";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

function TestHarness({
  staffId = "staff-1",
  staffAccountNumbers = [],
}: {
  staffId?: string;
  staffAccountNumbers?: StaffAccountNumber[];
}) {
  const [form, setForm] = useState<Pick<InvoiceFormData, "staffId" | "accountNumber">>({
    staffId,
    accountNumber: "",
  });

  function updateField<K extends keyof InvoiceFormData>(key: K, value: InvoiceFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div>
      <AccountNumberSelect
        form={form}
        updateField={updateField}
        staffAccountNumbers={staffAccountNumbers}
      />
      <button type="button">Outside</button>
    </div>
  );
}

describe("AccountNumberSelect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("keeps a newly typed account number when the user clicks away", async () => {
    const user = userEvent.setup();

    render(<TestHarness />);

    const input = screen.getByRole("combobox");
    await user.click(input);
    await user.type(input, "ACCT-42");
    await user.click(screen.getByRole("button", { name: "Outside" }));

    await waitFor(() => {
      expect(input).toHaveValue("ACCT-42");
    });
    expect(screen.getByPlaceholderText("Description for this account number…")).toBeInTheDocument();
  });

  it("keeps a newly typed account number when the user confirms it with Enter", async () => {
    const user = userEvent.setup();

    render(<TestHarness />);

    const input = screen.getByRole("combobox");
    await user.click(input);
    await user.type(input, "ACCT-42");
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(input).toHaveValue("ACCT-42");
    });
    expect(screen.getByPlaceholderText("Description for this account number…")).toBeInTheDocument();
  });

  it("keeps a typed account number even before a requestor is selected", async () => {
    const user = userEvent.setup();

    render(<TestHarness staffId="" />);

    const input = screen.getByRole("combobox");
    await user.click(input);
    await user.type(input, "ACCT-42");
    await user.click(screen.getByRole("button", { name: "Outside" }));

    await waitFor(() => {
      expect(input).toHaveValue("ACCT-42");
    });
    expect(screen.queryByPlaceholderText("Description for this account number…")).not.toBeInTheDocument();
  });

  it("saves the committed account number to the staff record", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
    } satisfies Partial<Response>);
    vi.stubGlobal("fetch", fetchMock);

    render(<TestHarness />);

    const input = screen.getByRole("combobox");
    await user.click(input);
    await user.type(input, "ACCT-42");
    await user.keyboard("{Enter}");

    const descriptionInput = await screen.findByPlaceholderText("Description for this account number…");
    await user.type(descriptionInput, "Grant account");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(fetchMock).toHaveBeenCalledWith("/api/staff/staff-1/account-numbers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accountCode: "ACCT-42",
        description: "Grant account",
      }),
    });
    await waitFor(() => {
      expect(input).toHaveValue("ACCT-42");
    });
  });
});
