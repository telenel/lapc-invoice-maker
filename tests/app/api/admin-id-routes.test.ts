import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/domains/staff/service", () => ({
  staffService: {
    getById: vi.fn(),
    update: vi.fn(),
    partialUpdate: vi.fn(),
    softDelete: vi.fn(),
    getAccountNumbers: vi.fn(),
    upsertAccountNumber: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    category: {
      update: vi.fn(),
    },
    quickPickItem: {
      update: vi.fn(),
      delete: vi.fn(),
    },
    savedLineItem: {
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import { getServerSession } from "next-auth";
import { staffService } from "@/domains/staff/service";
import { prisma } from "@/lib/prisma";
import { GET as getStaff, PATCH as patchStaff, PUT as putStaff, DELETE as deleteStaff } from "@/app/api/staff/[id]/route";
import { GET as getStaffAccountNumbers, POST as createStaffAccount } from "@/app/api/staff/[id]/account-numbers/route";
import { DELETE as deleteCategory, PUT as updateCategory } from "@/app/api/categories/[id]/route";
import { DELETE as deleteQuickPick, PUT as updateQuickPick } from "@/app/api/quick-picks/[id]/route";
import { DELETE as deleteSavedLineItem, PUT as updateSavedLineItem } from "@/app/api/saved-items/[id]/route";

describe("GET /api/staff/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "u1", role: "admin" },
    } as never);
    vi.mocked(staffService.getById).mockResolvedValue({ id: "staff-1" } as never);
  });

  it("normalizes a whitespace staff id", async () => {
    const response = await getStaff(
      new NextRequest("http://localhost/api/staff/%20staff-1%20"),
      { params: Promise.resolve({ id: "  staff-1  " }) },
    );

    expect(response.status).toBe(200);
    expect(staffService.getById).toHaveBeenCalledWith("staff-1");
  });

  it("rejects an empty staff id", async () => {
    const response = await getStaff(
      new NextRequest("http://localhost/api/staff/%20"),
      { params: Promise.resolve({ id: "   " }) },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid staff id" });
    expect(staffService.getById).not.toHaveBeenCalled();
  });
});

describe("PUT /api/staff/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "admin-user", role: "admin" },
    } as never);
    vi.mocked(staffService.update).mockResolvedValue({
      id: "staff-1",
    } as never);
  });

  it("rejects non-object payloads for staff updates", async () => {
    const response = await putStaff(
      new NextRequest("http://localhost/api/staff/staff-1", {
        method: "PUT",
        body: JSON.stringify([1, 2, 3]),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ id: "staff-1" }) },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid request body" });
    expect(staffService.update).not.toHaveBeenCalled();
  });

  it("allows authenticated non-admin users to edit staff members", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user-1", role: "user" },
    } as never);

    const response = await putStaff(
      new NextRequest("http://localhost/api/staff/staff-1", {
        method: "PUT",
        body: JSON.stringify({
          name: "Jane Doe",
          title: "Manager",
          department: "CopyTech",
          accountCode: "1234",
          extension: "4321",
          email: "staff@example.com",
          phone: "555-0100",
          approvalChain: [],
        }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ id: " staff-1 " }) },
    );

    expect(response.status).toBe(200);
    expect(staffService.update).toHaveBeenCalledWith("staff-1", {
      name: "Jane Doe",
      title: "Manager",
      department: "CopyTech",
      accountCode: "1234",
      extension: "4321",
      email: "staff@example.com",
      phone: "555-0100",
      approvalChain: [],
    });
  });
});

describe("PATCH /api/staff/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "admin-user", role: "admin" },
    } as never);
    vi.mocked(staffService.partialUpdate).mockResolvedValue({
      id: "staff-1",
    } as never);
  });

  it("rejects non-object payloads for staff partial updates", async () => {
    const response = await patchStaff(
      new NextRequest("http://localhost/api/staff/staff-1", {
        method: "PATCH",
        body: "\"bad\"",
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ id: " staff-1 " }) },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid request body" });
    expect(staffService.partialUpdate).not.toHaveBeenCalled();
  });

  it("allows authenticated non-admin users to patch invoice and quote contact fields", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user-1", role: "user" },
    } as never);

    const response = await patchStaff(
      new NextRequest("http://localhost/api/staff/staff-1", {
        method: "PATCH",
        body: JSON.stringify({
          extension: "4321",
          email: "staff@example.com",
          phone: "555-0100",
          department: "CopyTech",
        }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ id: " staff-1 " }) },
    );

    expect(response.status).toBe(200);
    expect(staffService.partialUpdate).toHaveBeenCalledWith("staff-1", {
      extension: "4321",
      email: "staff@example.com",
      phone: "555-0100",
      department: "CopyTech",
    });
  });

});

describe("DELETE /api/staff/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "admin-user", role: "admin" },
    } as never);
    vi.mocked(staffService.softDelete).mockResolvedValue(undefined as never);
  });

  it("normalizes whitespace on staff delete id", async () => {
    const response = await deleteStaff(
      new NextRequest("http://localhost/api/staff/ staff-1 "),
      { params: Promise.resolve({ id: "  staff-1  " }) },
    );

    expect(response.status).toBe(200);
    expect(staffService.softDelete).toHaveBeenCalledWith("staff-1");
  });

  it("rejects empty staff id before delete", async () => {
    const response = await deleteStaff(
      new NextRequest("http://localhost/api/staff/%20"),
      { params: Promise.resolve({ id: "   " }) },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid staff id" });
    expect(staffService.softDelete).not.toHaveBeenCalled();
  });
});

describe("GET /api/staff/:id/account-numbers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "u1", role: "admin" },
    } as never);
    vi.mocked(staffService.getAccountNumbers).mockResolvedValue([]);
  });

  it("normalizes staff id for account-number lookup", async () => {
    const response = await getStaffAccountNumbers(
      new NextRequest("http://localhost/api/staff/staff-1/account-numbers"),
      { params: Promise.resolve({ id: "  staff-1  " }) },
    );

    expect(response.status).toBe(200);
    expect(staffService.getAccountNumbers).toHaveBeenCalledWith("staff-1");
  });
});

describe("POST /api/staff/:id/account-numbers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "admin-user", role: "admin" },
    } as never);
    vi.mocked(staffService.upsertAccountNumber).mockResolvedValue(undefined as never);
  });

  it("rejects non-object account-number bodies", async () => {
    const response = await createStaffAccount(
      new NextRequest("http://localhost/api/staff/staff-1/account-numbers", {
        method: "POST",
        body: JSON.stringify([1, 2, 3]),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ id: "staff-1" }) },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid request body" });
    expect(staffService.upsertAccountNumber).not.toHaveBeenCalled();
  });

  it("allows authenticated non-admin users to save account numbers from the invoice form", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user-1", role: "user" },
    } as never);

    const response = await createStaffAccount(
      new NextRequest("http://localhost/api/staff/staff-1/account-numbers", {
        method: "POST",
        body: JSON.stringify({
          accountCode: " ACCT-42 ",
          description: " Catering ",
        }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ id: " staff-1 " }) },
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ success: true });
    expect(staffService.upsertAccountNumber).toHaveBeenCalledWith({
      staffId: "staff-1",
      accountCode: "ACCT-42",
      description: "Catering",
    });
  });
});

describe("PUT /api/categories/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "admin-user", role: "admin" },
    } as never);
    vi.mocked(prisma.category.update).mockResolvedValue({ id: "c1" } as never);
  });

  it("rejects whitespace-only category ids", async () => {
    const response = await updateCategory(
      new NextRequest("http://localhost/api/categories/%20", {
        method: "PUT",
        body: JSON.stringify({ name: "Office" }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ id: "   " }) },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid category id" });
    expect(prisma.category.update).not.toHaveBeenCalled();
  });

  it("rejects non-object category update payloads", async () => {
    const response = await updateCategory(
      new NextRequest("http://localhost/api/categories/c1", {
        method: "PUT",
        body: JSON.stringify(["bad"]),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ id: "c1" }) },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid request body" });
    expect(prisma.category.update).not.toHaveBeenCalled();
  });

  it("rejects whitespace-only category id for delete", async () => {
    const response = await deleteCategory(
      new NextRequest("http://localhost/api/categories/%20", { method: "DELETE" }),
      { params: Promise.resolve({ id: "   " }) },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid category id" });
    expect(prisma.category.update).not.toHaveBeenCalled();
  });
});

describe("PUT /api/quick-picks/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "admin-user", role: "admin" },
    } as never);
    vi.mocked(prisma.quickPickItem.update).mockResolvedValue({ id: "q1" } as never);
  });

  it("normalizes whitespace quick-pick ids", async () => {
    const response = await updateQuickPick(
      new NextRequest("http://localhost/api/quick-picks/%20q1%20", {
        method: "PUT",
        body: JSON.stringify({
          description: "Quick",
          defaultPrice: 5,
          department: "IT",
        }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ id: "  q1  " }) },
    );

    expect(response.status).toBe(200);
    expect(prisma.quickPickItem.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "q1" } }),
    );
  });

  it("rejects non-object quick-pick payloads", async () => {
    const response = await updateQuickPick(
      new NextRequest("http://localhost/api/quick-picks/q1", {
        method: "PUT",
        body: JSON.stringify("bad"),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ id: "q1" }) },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid request body" });
    expect(prisma.quickPickItem.update).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/quick-picks/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "admin-user", role: "admin" },
    } as never);
    vi.mocked(prisma.quickPickItem.delete).mockResolvedValue({} as never);
  });

  it("rejects empty quick-pick id", async () => {
    const response = await deleteQuickPick(
      new NextRequest("http://localhost/api/quick-picks/%20", { method: "DELETE" }),
      { params: Promise.resolve({ id: "   " }) },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid quick pick id" });
    expect(prisma.quickPickItem.delete).not.toHaveBeenCalled();
  });
});

describe("PUT /api/saved-items/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "admin-user", role: "admin" },
    } as never);
    vi.mocked(prisma.savedLineItem.update).mockResolvedValue({
      id: "s1",
      department: "IT",
      description: "Stapler",
      unitPrice: 2,
      usageCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as never);
  });

  it("rejects non-object saved-item payloads", async () => {
    const response = await updateSavedLineItem(
      new NextRequest("http://localhost/api/saved-items/s1", {
        method: "PUT",
        body: JSON.stringify([1, 2, 3]),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ id: "s1" }) },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid request body" });
    expect(prisma.savedLineItem.update).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/saved-items/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "admin-user", role: "admin" },
    } as never);
    vi.mocked(prisma.savedLineItem.delete).mockResolvedValue({} as never);
  });

  it("normalizes whitespace saved-item id", async () => {
    const response = await deleteSavedLineItem(
      new NextRequest("http://localhost/api/saved-items/ s1 ", { method: "DELETE" }),
      { params: Promise.resolve({ id: "  s1  " }) },
    );

    expect(response.status).toBe(200);
    expect(prisma.savedLineItem.delete).toHaveBeenCalledWith({ where: { id: "s1" } });
  });

  it("rejects empty saved-item id", async () => {
    const response = await deleteSavedLineItem(
      new NextRequest("http://localhost/api/saved-items/%20", { method: "DELETE" }),
      { params: Promise.resolve({ id: "   " }) },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid saved item id" });
    expect(prisma.savedLineItem.delete).not.toHaveBeenCalled();
  });
});
