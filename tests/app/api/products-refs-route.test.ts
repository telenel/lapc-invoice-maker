import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

const prismServerMocks = vi.hoisted(() => ({
  listVendors: vi.fn(),
  listDccs: vi.fn(),
  listTaxTypes: vi.fn(),
  listTagTypes: vi.fn(),
  listStatusCodes: vi.fn(),
  listPackageTypes: vi.fn(),
  listColors: vi.fn(),
  listBindings: vi.fn(),
}));

const refDataMocks = vi.hoisted(() => ({
  loadCommittedProductRefSnapshot: vi.fn(),
}));

vi.mock("@/domains/product/prism-server", () => prismServerMocks);
vi.mock("@/domains/product/ref-data", () => refDataMocks);
vi.mock("@/lib/prism", () => ({
  isPrismConfigured: vi.fn(),
}));

import { getServerSession } from "next-auth";
import { isPrismConfigured } from "@/lib/prism";
import {
  listBindings,
  listColors,
  listDccs,
  listPackageTypes,
  listStatusCodes,
  listTagTypes,
  listTaxTypes,
  listVendors,
} from "@/domains/product/prism-server";
import { loadCommittedProductRefSnapshot } from "@/domains/product/ref-data";
import { GET } from "@/app/api/products/refs/route";

const committedSnapshot = {
  vendors: [{ vendorId: 21, name: "PENS ETC (3001795)", pierceItems: 5939 }],
  dccs: [{ dccId: 1313290, deptNum: 20, classNum: 10, catNum: 10, deptName: "NOT USE=111010", className: "DO NOT USE", catName: "DO NOT USE", pierceItems: 100 }],
  taxTypes: [{ taxTypeId: 4, description: "STATE", pierceItems: 200 }],
  tagTypes: [{ tagTypeId: 3, label: "LARGE w/Price/Color", subsystem: 1, pierceRows: 300 }],
  statusCodes: [{ statusCodeId: 2, label: "Active", pierceRows: 400 }],
  packageTypes: [{ code: "EA", label: "Each", defaultQty: 1, pierceItems: 500 }],
  colors: [{ colorId: 2, label: "BLACK", pierceItems: 600 }],
  bindings: [{ bindingId: 15, label: "PAPERBACK", pierceBooks: 700 }],
};

describe("GET /api/products/refs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "u1", role: "user" },
    } as never);
    vi.mocked(loadCommittedProductRefSnapshot).mockResolvedValue(committedSnapshot as never);
    vi.mocked(listVendors).mockResolvedValue(committedSnapshot.vendors as never);
    vi.mocked(listDccs).mockResolvedValue(committedSnapshot.dccs as never);
    vi.mocked(listTaxTypes).mockResolvedValue(committedSnapshot.taxTypes as never);
    vi.mocked(listTagTypes).mockResolvedValue(committedSnapshot.tagTypes as never);
    vi.mocked(listStatusCodes).mockResolvedValue(committedSnapshot.statusCodes as never);
    vi.mocked(listPackageTypes).mockResolvedValue(committedSnapshot.packageTypes as never);
    vi.mocked(listColors).mockResolvedValue(committedSnapshot.colors as never);
    vi.mocked(listBindings).mockResolvedValue(committedSnapshot.bindings as never);
  });

  it("falls back to the committed snapshot when Prism is not configured", async () => {
    vi.mocked(isPrismConfigured).mockReturnValue(false);

    const response = await GET(new NextRequest("http://localhost/api/products/refs"));

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, max-age=60");
    expect(await response.json()).toEqual(committedSnapshot);
    expect(loadCommittedProductRefSnapshot).toHaveBeenCalledTimes(1);
    expect(listVendors).not.toHaveBeenCalled();
  });

  it("falls back to the committed snapshot when a live Prism call throws", async () => {
    vi.mocked(isPrismConfigured).mockReturnValue(true);
    vi.mocked(listVendors).mockRejectedValue(new Error("live failure"));

    const response = await GET(new NextRequest("http://localhost/api/products/refs"));

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, max-age=60");
    expect(await response.json()).toEqual(committedSnapshot);
    expect(loadCommittedProductRefSnapshot).toHaveBeenCalledTimes(1);
  });

  it("returns the full live contract when the loaders succeed", async () => {
    vi.mocked(isPrismConfigured).mockReturnValue(true);

    const response = await GET(new NextRequest("http://localhost/api/products/refs"));

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, max-age=60");
    expect(await response.json()).toEqual(committedSnapshot);
    expect(loadCommittedProductRefSnapshot).not.toHaveBeenCalled();
  });
});
