import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PeopleSection } from "./people-section";
import { useInvoiceForm } from "@/components/invoice/invoice-form";
import { useQuoteForm } from "@/components/quote/quote-form";
import { renderHook } from "@testing-library/react";
import { staffApi } from "@/domains/staff/api-client";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/invoices/new",
}));

// staffSelect behavior is controlled per-describe via `staffSelectOnSelect`
let staffSelectOnSelect: ((staff: { id: string; name: string }) => void) | undefined;
vi.mock("@/components/invoice/staff-select", () => ({
  StaffSelect: ({ selectedId, onSelect }: { selectedId?: string; onSelect?: (s: { id: string; name: string }) => void }) => {
    staffSelectOnSelect = onSelect;
    return <div data-testid="staff-select">{selectedId ?? ""}</div>;
  },
}));
vi.mock("@/components/invoice/staff-summary-editor", () => ({
  StaffSummaryEditor: () => <div data-testid="staff-editor" />,
}));
vi.mock("@/domains/staff/api-client", () => ({
  staffApi: {
    // Default: resolve with a minimal StaffDetailResponse so quote-form's
    // staffId-watching useEffect doesn't crash when rendered with a staffId.
    getById: vi.fn().mockResolvedValue({
      id: "",
      name: "",
      title: "",
      department: "",
      extension: "",
      email: "",
      phone: "",
      accountCode: "",
      approvalChain: [],
      active: true,
      birthMonth: null,
      birthDay: null,
      accountNumbers: [],
      signerHistories: [],
    }),
  },
}));

describe("PeopleSection (invoice)", () => {
  it("renders staff select column + contact card column", () => {
    const { result } = renderHook(() => useInvoiceForm());
    render(
      <PeopleSection
        docType="invoice"
        composer={result.current}
        sectionStatus="default"
      />
    );
    expect(screen.getByText(/Who is the requestor/i)).toBeInTheDocument();
    expect(screen.getByTestId("staff-select")).toBeInTheDocument();
  });
});

describe("PeopleSection (quote)", () => {
  it("shows internal/external segmented control", () => {
    const { result } = renderHook(() => useQuoteForm());
    render(<PeopleSection docType="quote" composer={result.current} sectionStatus="default" />);
    expect(screen.getByRole("radio", { name: /Internal/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /External/i })).toBeInTheDocument();
  });

  it("hides recipient inputs in internal mode", () => {
    const { result } = renderHook(() => useQuoteForm({ staffId: "abc" }));
    render(<PeopleSection docType="quote" composer={result.current} sectionStatus="default" />);
    expect(screen.queryByPlaceholderText(/Recipient name/i)).toBeNull();
  });

  it("does NOT clear recipient fields when Internal is clicked without a staff selection", async () => {
    const user = userEvent.setup();
    const { result } = renderHook(() => useQuoteForm({ recipientName: "Alice", recipientOrg: "ACME" }));
    render(<PeopleSection docType="quote" composer={result.current} sectionStatus="default" />);
    // Initially external mode (no staffId): recipientOrg input visible with "ACME"
    const orgInput = screen.getByPlaceholderText(/Organization \(optional\)/i) as HTMLInputElement;
    expect(orgInput.value).toBe("ACME");
    // Click "Internal dept." radio without a staff → should no-op (guard returns early)
    await user.click(screen.getByRole("radio", { name: /Internal/i }));
    // Fields must remain intact — mode stays external because staffId is still empty
    expect(result.current.form.recipientOrg).toBe("ACME");
    expect(result.current.form.recipientName).toBe("Alice");
  });
});

// ---------------------------------------------------------------------------
// Regression: Fix 2 — Internal-click data guard
// ---------------------------------------------------------------------------

describe("PeopleSection (quote) — Internal-click data guard", () => {
  it("preserves external recipient data when Internal is clicked without a staff", async () => {
    const user = userEvent.setup();
    function Harness() {
      const composer = useQuoteForm({ recipientName: "Acme Co", recipientEmail: "a@b.com", recipientOrg: "Acme" });
      return (
        <PeopleSection docType="quote" composer={composer} sectionStatus="default" />
      );
    }
    render(<Harness />);
    // Confirm we start with populated external fields
    expect(screen.getByPlaceholderText(/Recipient name/i)).toHaveValue("Acme Co");
    // Click Internal — should NO-OP since no staff is selected
    await user.click(screen.getByRole("radio", { name: /Internal/i }));
    // Mode stays external: all recipient inputs still visible and unchanged
    expect(screen.getByPlaceholderText(/Recipient name/i)).toHaveValue("Acme Co");
    expect(screen.getByPlaceholderText(/Recipient email \(optional\)/i)).toHaveValue("a@b.com");
    expect(screen.getByPlaceholderText(/Organization \(optional\)/i)).toHaveValue("Acme");
    // The hint paragraph should be visible
    expect(screen.getByText(/Pick a requestor.*to switch to internal mode/i)).toBeInTheDocument();
  });

  it("preserves staff-derived recipientName when Internal is clicked while staff is already selected", async () => {
    const user = userEvent.setup();
    // Make staffApi.getById reject so the quote-form's staffId-watching
    // useEffect does NOT overwrite our seeded recipient fields.
    (staffApi.getById as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("noop"));

    const composerRef: { current: ReturnType<typeof useQuoteForm> | null } = { current: null };
    function Harness() {
      // Seed an "internal mode" state: staffId set + recipientName autofilled
      // from staff (mirrors what handleStaffSelect would have written).
      const composer = useQuoteForm({
        staffId: "abc",
        recipientName: "Alice Liddell",
        recipientEmail: "alice@example.com",
      });
      composerRef.current = composer;
      return <PeopleSection docType="quote" composer={composer} sectionStatus="default" />;
    }
    render(<Harness />);

    // Start state: in internal mode (staffId set), so recipient inputs are hidden
    expect(screen.queryByPlaceholderText(/Recipient name/i)).toBeNull();
    expect(composerRef.current?.form.recipientName).toBe("Alice Liddell");
    expect(composerRef.current?.form.recipientEmail).toBe("alice@example.com");

    // Click the already-checked Internal radio — must be a true no-op
    await user.click(screen.getByRole("radio", { name: /Internal/i }));

    // Mode remains internal; recipient inputs still hidden
    expect(screen.queryByPlaceholderText(/Recipient name/i)).toBeNull();
    // Critical: recipientName/recipientEmail preserved (quote save schema requires recipientName)
    expect(composerRef.current?.form.recipientName).toBe("Alice Liddell");
    expect(composerRef.current?.form.recipientEmail).toBe("alice@example.com");
  });
});

// ---------------------------------------------------------------------------
// Regression: Fix 1 — Staff detail adapter (invoice arm)
// ---------------------------------------------------------------------------

describe("PeopleSection (invoice) — staff detail adapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset to default empty-resolve so quote-form effects don't crash
    (staffApi.getById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "",
      name: "",
      title: "",
      department: "",
      extension: "",
      email: "",
      phone: "",
      accountCode: "",
      approvalChain: [],
      active: true,
      birthMonth: null,
      birthDay: null,
      accountNumbers: [],
      signerHistories: [],
    });
  });

  it("fetches StaffDetailResponse via staffApi.getById before invoking handleStaffSelect", async () => {
    const detailResponse = {
      id: "abc",
      name: "Alice",
      title: "Manager",
      department: "BKST",
      extension: "1234",
      email: "alice@example.com",
      phone: "555-1234",
      accountCode: "AC1",
      approvalChain: [],
      active: true,
      birthMonth: null,
      birthDay: null,
      accountNumbers: [{ id: "an1", accountCode: "AC1", description: "Books", lastUsedAt: "2026-01-01" }],
      signerHistories: [],
    };
    (staffApi.getById as ReturnType<typeof vi.fn>).mockResolvedValueOnce(detailResponse);

    // Use a Harness so we observe live React state after the async adapter resolves.
    let latestAccountNumber = "";
    function Harness() {
      const composer = useInvoiceForm();
      latestAccountNumber = composer.form.accountNumber;
      return <PeopleSection docType="invoice" composer={composer} sectionStatus="default" />;
    }
    render(<Harness />);

    // Simulate StaffSelect calling onSelect with a bare StaffResponse (no accountNumbers)
    await act(async () => {
      await staffSelectOnSelect?.({ id: "abc", name: "Alice" });
    });

    // staffApi.getById must have been called with the staff id (the adapter fetched detail)
    expect(staffApi.getById).toHaveBeenCalledWith("abc");

    // The invoice form's accountNumber should reflect the resolved detail's first accountNumber
    await waitFor(() => {
      expect(latestAccountNumber).toBe("AC1");
    });
  });

  it("ignores stale staff-detail responses — last-write wins (invoice arm)", async () => {
    const detail1 = {
      id: "id-1",
      name: "First",
      title: "T1",
      department: "DEPT1",
      extension: "111",
      email: "first@example.com",
      phone: "111-1111",
      accountCode: "C1",
      approvalChain: [],
      active: true,
      birthMonth: null,
      birthDay: null,
      accountNumbers: [{ id: "an1", accountCode: "C1", description: "D1", lastUsedAt: "2026-01-01" }],
      signerHistories: [],
    };
    const detail2 = {
      id: "id-2",
      name: "Second",
      title: "T2",
      department: "DEPT2",
      extension: "222",
      email: "second@example.com",
      phone: "222-2222",
      accountCode: "C2",
      approvalChain: [],
      active: true,
      birthMonth: null,
      birthDay: null,
      accountNumbers: [{ id: "an2", accountCode: "C2", description: "D2", lastUsedAt: "2026-01-01" }],
      signerHistories: [],
    };

    // First call hangs until we manually resolve; second call resolves immediately.
    let resolveFirst!: (v: typeof detail1) => void;
    (staffApi.getById as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(new Promise<typeof detail1>((res) => { resolveFirst = res; }))
      .mockResolvedValueOnce(detail2);

    let capturedDepartment = "";
    let capturedAccountCode = "";
    function Harness() {
      const composer = useInvoiceForm();
      capturedDepartment = composer.form.department;
      capturedAccountCode = composer.form.accountNumber;
      return <PeopleSection docType="invoice" composer={composer} sectionStatus="default" />;
    }
    render(<Harness />);

    // Select staff 1 — fetch hangs
    act(() => { staffSelectOnSelect?.({ id: "id-1", name: "First" }); });

    // Select staff 2 before fetch 1 resolves — fetch 2 resolves immediately
    await act(async () => {
      await staffSelectOnSelect?.({ id: "id-2", name: "Second" });
    });

    // Now let the stale (first) response resolve
    act(() => { resolveFirst(detail1); });

    // Wait a tick to allow any erroneous state update to propagate
    await waitFor(() => {
      // Only staff 2's data should be present — stale detail1 must have been discarded
      expect(capturedDepartment).toBe("DEPT2");
      expect(capturedAccountCode).toBe("C2");
    });
  });
});
