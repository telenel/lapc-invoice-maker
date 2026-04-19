import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  deleteMock,
  eqMock,
  fromMock,
  supabaseMock,
} = vi.hoisted(() => {
  const eq = vi.fn().mockResolvedValue({ error: null });
  const del = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ delete: del }));
  return {
    deleteMock: del,
    eqMock: eq,
    fromMock: from,
    supabaseMock: { from },
  };
});

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

vi.mock("@/lib/prism", () => ({
  isPrismConfigured: vi.fn(() => true),
}));

vi.mock("@/domains/product/prism-server", () => ({
  discontinueItem: vi.fn(async () => ({ affected: 1 })),
  deleteTestItem: vi.fn(async () => ({ affected: 1 })),
}));

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdminClient: vi.fn(() => supabaseMock),
}));

import { getServerSession } from "next-auth";
import { DELETE } from "@/app/api/products/[sku]/route";

describe("DELETE /api/products/[sku]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deleteMock.mockReturnValue({ eq: eqMock });
    eqMock.mockResolvedValue({ error: null });
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "admin-1", role: "admin" },
    } as never);
  });

  it("removes the mirrored catalog row after a soft discontinue", async () => {
    const response = await DELETE(
      new NextRequest("http://localhost/api/products/101"),
      { params: Promise.resolve({ sku: "101" }) },
    );

    expect(response.status).toBe(200);
    expect(fromMock).toHaveBeenCalledWith("products");
    expect(deleteMock).toHaveBeenCalledTimes(1);
    expect(eqMock).toHaveBeenCalledWith("sku", 101);
  });
});
