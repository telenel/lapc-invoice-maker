import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

let sessionRole: "admin" | "user" = "user";

vi.mock("next-auth/react", () => ({
  useSession: () => ({
    status: "authenticated",
    data: {
      user: {
        id: "user-1",
        role: sessionRole,
      },
    },
  }),
}));

vi.mock("@/lib/use-sse", () => ({
  useSSE: vi.fn(),
}));

vi.mock("@/domains/staff/api-client", () => ({
  staffApi: {
    listPaginated: vi.fn(),
    delete: vi.fn(),
    list: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock("@/components/staff/staff-form", () => ({
  StaffForm: ({ trigger }: { trigger: ReactNode }) => <>{trigger}</>,
}));

import { StaffTable } from "@/components/staff/staff-table";

describe("StaffTable access", () => {
  beforeEach(() => {
    sessionRole = "user";
  });

  afterEach(() => {
    cleanup();
  });

  it("lets non-admin users add and edit staff, but keeps deactivate admin-only", () => {
    render(
      <StaffTable
        initialData={{
          data: [
            {
              id: "staff-1",
              name: "Jane Doe",
              title: "Manager",
              department: "CopyTech",
              accountCode: "1234",
              extension: "4321",
              email: "jane@example.com",
              phone: "",
              birthMonth: null,
              birthDay: null,
              approvalChain: [],
              active: true,
            },
          ],
          total: 1,
          page: 1,
          pageSize: 20,
        }}
      />,
    );

    expect(screen.getByRole("button", { name: /add staff member/i })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /edit/i }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /deactivate staff member/i })).not.toBeInTheDocument();
  });
});
