import { beforeEach, describe, expect, it, vi } from "vitest";

const rangeMock = vi.fn();
const orderMock = vi.fn();
const selectMock = vi.fn();
const fromMock = vi.fn();
const queryMock = vi.fn();
const inputMock = vi.fn();
const requestMock = vi.fn();

vi.mock("@/lib/prism", () => ({
  getPrismPool: vi.fn(),
  sql: {
    Int: "Int",
  },
}));

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdminClient: vi.fn(),
}));

import { getPrismPool } from "@/lib/prism";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { runPrismPull } from "@/domains/product/prism-sync";

describe("runPrismPull", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    rangeMock.mockResolvedValue({ data: [], error: null });
    orderMock.mockReturnValue({ range: rangeMock });
    selectMock.mockReturnValue({ order: orderMock });
    fromMock.mockReturnValue({ select: selectMock });

    inputMock.mockReturnThis();
    queryMock.mockResolvedValue({ recordset: [] });
    requestMock.mockReturnValue({
      input: inputMock,
      query: queryMock,
    });

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: fromMock,
    } as never);
    vi.mocked(getPrismPool).mockResolvedValue({
      request: requestMock,
    } as never);
  });

  it("queries the real Prism DCC name columns", async () => {
    await runPrismPull({ pageSize: 1 });

    const sqlText = queryMock.mock.calls[0]?.[0];
    expect(sqlText).toContain("dep.DeptName");
    expect(sqlText).toContain("cls.ClassName");
    expect(sqlText).toContain("cat.CatName");
    expect(sqlText).not.toContain("dep.Name");
    expect(sqlText).not.toContain("cls.Name");
    expect(sqlText).not.toContain("cat.Name");
  });
});
