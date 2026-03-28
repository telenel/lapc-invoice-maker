// tests/domains/admin/service.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/domains/admin/repository", () => ({
  adminRepository: {
    findAllUsers: vi.fn(),
    findUserById: vi.fn(),
    findUserByUsername: vi.fn(),
    findUserByUsernameExcluding: vi.fn(),
    createUser: vi.fn(),
    updateUser: vi.fn(),
    resetUserPassword: vi.fn(),
    deleteUser: vi.fn(),
    findAllAccountCodes: vi.fn(),
    findStaffById: vi.fn(),
    createAccountCode: vi.fn(),
    deleteAccountCode: vi.fn(),
    getTableCounts: vi.fn(),
    getDatabaseSize: vi.fn(),
  },
}));

vi.mock("bcryptjs", () => ({
  default: {
    hash: vi.fn().mockResolvedValue("hashed"),
    compare: vi.fn(),
  },
}));

import { adminRepository } from "@/domains/admin/repository";
import { adminService } from "@/domains/admin/service";

const mockRepo = vi.mocked(adminRepository, true);

// ── Fixture helpers ───────────────────────────────────────────────────────

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: "u1",
    username: "alice",
    name: "Alice Smith",
    email: "alice@test.com",
    role: "user",
    active: true,
    setupComplete: false,
    createdAt: new Date("2026-01-01"),
    ...overrides,
  };
}

function makeAccountCode(overrides: Record<string, unknown> = {}) {
  return {
    id: "ac1",
    staffId: "s1",
    accountCode: "1234",
    description: "Main Account",
    createdAt: new Date("2026-01-01"),
    staff: { id: "s1", name: "Alice", department: "IT" },
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe("adminService", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  // ── listUsers ─────────────────────────────────────────────────────────

  describe("listUsers", () => {
    it("returns mapped UserResponse array", async () => {
      const users = [makeUser(), makeUser({ id: "u2", username: "bob", name: "Bob Jones" })];
      mockRepo.findAllUsers.mockResolvedValue(users as never);

      const result = await adminService.listUsers();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: "u1",
        username: "alice",
        name: "Alice Smith",
        email: "alice@test.com",
        role: "user",
        active: true,
        setupComplete: false,
        createdAt: "2026-01-01T00:00:00.000Z",
      });
    });

    it("maps createdAt Date to ISO string", async () => {
      mockRepo.findAllUsers.mockResolvedValue([makeUser({ createdAt: new Date("2026-03-15") })] as never);

      const result = await adminService.listUsers();

      expect(result[0].createdAt).toBe("2026-03-15T00:00:00.000Z");
    });
  });

  // ── createUser ────────────────────────────────────────────────────────

  describe("createUser", () => {
    it("generates username from first word of name (lowercase)", async () => {
      mockRepo.findUserByUsername.mockResolvedValue(null);
      mockRepo.createUser.mockResolvedValue(makeUser() as never);

      await adminService.createUser({ name: "Alice Smith" });

      expect(mockRepo.findUserByUsername).toHaveBeenCalledWith("alice");
      expect(mockRepo.createUser).toHaveBeenCalledWith(
        expect.objectContaining({ username: "alice" })
      );
    });

    it("hashes the default password before creating", async () => {
      mockRepo.findUserByUsername.mockResolvedValue(null);
      mockRepo.createUser.mockResolvedValue(makeUser() as never);

      await adminService.createUser({ name: "Alice Smith" });

      expect(mockRepo.createUser).toHaveBeenCalledWith(
        expect.objectContaining({ passwordHash: "hashed" })
      );
    });

    it("trims whitespace from name before storing", async () => {
      mockRepo.findUserByUsername.mockResolvedValue(null);
      mockRepo.createUser.mockResolvedValue(makeUser() as never);

      await adminService.createUser({ name: "  Alice Smith  " });

      expect(mockRepo.createUser).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Alice Smith" })
      );
    });

    it("returns mapped UserResponse", async () => {
      mockRepo.findUserByUsername.mockResolvedValue(null);
      mockRepo.createUser.mockResolvedValue(makeUser() as never);

      const result = await adminService.createUser({ name: "Alice Smith" });

      expect(result.id).toBe("u1");
      expect(result.username).toBe("alice");
    });
  });

  // ── createUser collision handling ────────────────────────────────────

  describe("createUser username collision handling", () => {
    it("appends '2' when username is already taken", async () => {
      mockRepo.findUserByUsername
        .mockResolvedValueOnce(makeUser() as never) // "alice" taken
        .mockResolvedValueOnce(null); // "alice2" available
      mockRepo.createUser.mockResolvedValue(makeUser({ username: "alice2" }) as never);

      await adminService.createUser({ name: "Alice Johnson" });

      expect(mockRepo.createUser).toHaveBeenCalledWith(
        expect.objectContaining({ username: "alice2" })
      );
    });

    it("appends '3' when both username and username2 are taken", async () => {
      mockRepo.findUserByUsername
        .mockResolvedValueOnce(makeUser() as never)         // "alice" taken
        .mockResolvedValueOnce(makeUser({ username: "alice2" }) as never) // "alice2" taken
        .mockResolvedValueOnce(null);                       // "alice3" available
      mockRepo.createUser.mockResolvedValue(makeUser({ username: "alice3" }) as never);

      await adminService.createUser({ name: "Alice Brown" });

      expect(mockRepo.createUser).toHaveBeenCalledWith(
        expect.objectContaining({ username: "alice3" })
      );
    });
  });

  // ── updateUser ────────────────────────────────────────────────────────

  describe("updateUser", () => {
    it("delegates to repository with provided fields", async () => {
      const updated = makeUser({ name: "Alice Updated", email: "new@test.com" });
      mockRepo.updateUser.mockResolvedValue(updated as never);

      const result = await adminService.updateUser("u1", {
        name: "Alice Updated",
        email: "new@test.com",
      });

      expect(mockRepo.updateUser).toHaveBeenCalledWith("u1", {
        name: "Alice Updated",
        email: "new@test.com",
      });
      expect(result.name).toBe("Alice Updated");
    });

    it("only passes defined fields in update data", async () => {
      mockRepo.updateUser.mockResolvedValue(makeUser() as never);

      await adminService.updateUser("u1", { name: "New Name" });

      expect(mockRepo.updateUser).toHaveBeenCalledWith("u1", { name: "New Name" });
    });

    it("passes role when provided", async () => {
      mockRepo.updateUser.mockResolvedValue(makeUser({ role: "admin" }) as never);

      await adminService.updateUser("u1", { role: "admin" });

      expect(mockRepo.updateUser).toHaveBeenCalledWith("u1", { role: "admin" });
    });
  });

  // ── resetPassword ─────────────────────────────────────────────────────

  describe("resetPassword", () => {
    it("generates a new hash with bcrypt", async () => {
      mockRepo.findUserById.mockResolvedValue(makeUser() as never);
      mockRepo.findUserByUsernameExcluding.mockResolvedValue(null);
      mockRepo.resetUserPassword.mockResolvedValue(makeUser() as never);

      await adminService.resetPassword("u1");

      expect(mockRepo.resetUserPassword).toHaveBeenCalledWith(
        "u1",
        expect.objectContaining({ passwordHash: "hashed" })
      );
    });

    it("generates a new username from existing user's name", async () => {
      mockRepo.findUserById.mockResolvedValue(makeUser() as never);
      mockRepo.findUserByUsernameExcluding.mockResolvedValue(null);
      mockRepo.resetUserPassword.mockResolvedValue(makeUser() as never);

      await adminService.resetPassword("u1");

      expect(mockRepo.findUserByUsernameExcluding).toHaveBeenCalledWith("alice", "u1");
      expect(mockRepo.resetUserPassword).toHaveBeenCalledWith(
        "u1",
        expect.objectContaining({ username: "alice" })
      );
    });

    it("resets setupComplete (via resetUserPassword in repo)", async () => {
      mockRepo.findUserById.mockResolvedValue(makeUser({ setupComplete: true }) as never);
      mockRepo.findUserByUsernameExcluding.mockResolvedValue(null);
      const resetUser = makeUser({ setupComplete: false });
      mockRepo.resetUserPassword.mockResolvedValue(resetUser as never);

      const result = await adminService.resetPassword("u1");

      expect(result.setupComplete).toBe(false);
    });

    it("uses 'user' as fallback name when user not found", async () => {
      mockRepo.findUserById.mockResolvedValue(null);
      mockRepo.findUserByUsernameExcluding.mockResolvedValue(null);
      mockRepo.resetUserPassword.mockResolvedValue(makeUser({ username: "user" }) as never);

      await adminService.resetPassword("u1");

      expect(mockRepo.findUserByUsernameExcluding).toHaveBeenCalledWith("user", "u1");
    });
  });

  // ── deleteUser ────────────────────────────────────────────────────────

  describe("deleteUser", () => {
    it("delegates to repository deleteUser", async () => {
      mockRepo.deleteUser.mockResolvedValue(undefined as never);

      await adminService.deleteUser("u1");

      expect(mockRepo.deleteUser).toHaveBeenCalledWith("u1");
    });
  });

  // ── listAccountCodes ──────────────────────────────────────────────────

  describe("listAccountCodes", () => {
    it("returns mapped AccountCodeResponse array", async () => {
      const codes = [
        makeAccountCode(),
        makeAccountCode({ id: "ac2", accountCode: "5678", description: "Secondary" }),
      ];
      mockRepo.findAllAccountCodes.mockResolvedValue(codes as never);

      const result = await adminService.listAccountCodes();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: "ac1",
        staffId: "s1",
        accountCode: "1234",
        description: "Main Account",
        createdAt: "2026-01-01T00:00:00.000Z",
        staff: { id: "s1", name: "Alice", department: "IT" },
      });
    });

    it("maps createdAt Date to ISO string", async () => {
      mockRepo.findAllAccountCodes.mockResolvedValue([
        makeAccountCode({ createdAt: new Date("2026-06-15") }),
      ] as never);

      const result = await adminService.listAccountCodes();

      expect(result[0].createdAt).toBe("2026-06-15T00:00:00.000Z");
    });
  });

  // ── createAccountCode ─────────────────────────────────────────────────

  describe("createAccountCode", () => {
    it("throws 404 when staff not found", async () => {
      mockRepo.findStaffById.mockResolvedValue(null);

      await expect(
        adminService.createAccountCode({ staffId: "missing", accountCode: "1234", description: "X" })
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it("delegates to repository when staff exists", async () => {
      const staff = { id: "s1", name: "Alice", department: "IT" };
      mockRepo.findStaffById.mockResolvedValue(staff as never);
      const code = makeAccountCode();
      mockRepo.createAccountCode.mockResolvedValue(code as never);

      const result = await adminService.createAccountCode({
        staffId: "s1",
        accountCode: "1234",
        description: "Main Account",
      });

      expect(mockRepo.createAccountCode).toHaveBeenCalledWith({
        staffId: "s1",
        accountCode: "1234",
        description: "Main Account",
      });
      expect(result.id).toBe("ac1");
    });
  });

  // ── deleteAccountCode ─────────────────────────────────────────────────

  describe("deleteAccountCode", () => {
    it("delegates to repository deleteAccountCode", async () => {
      mockRepo.deleteAccountCode.mockResolvedValue(undefined as never);

      await adminService.deleteAccountCode("ac1");

      expect(mockRepo.deleteAccountCode).toHaveBeenCalledWith("ac1");
    });
  });

  // ── getDbHealth ───────────────────────────────────────────────────────

  describe("getDbHealth", () => {
    it("returns status=connected with correct shape", async () => {
      const tableCounts = {
        users: 3,
        staff: 10,
        invoices: 25,
        invoiceItems: 80,
        categories: 5,
        quickPickItems: 20,
        staffAccountNumbers: 15,
        staffSignerHistory: 8,
        savedLineItems: 12,
      };
      mockRepo.getTableCounts.mockResolvedValue(tableCounts as never);
      mockRepo.getDatabaseSize.mockResolvedValue("42 MB" as never);

      const result = await adminService.getDbHealth();

      expect(result.status).toBe("connected");
      expect(result.dbSize).toBe("42 MB");
      expect(result.tables).toEqual(tableCounts);
      expect(typeof result.timestamp).toBe("string");
      // Validate timestamp is a valid ISO string
      expect(() => new Date(result.timestamp)).not.toThrow();
    });

    it("calls getTableCounts and getDatabaseSize in parallel", async () => {
      mockRepo.getTableCounts.mockResolvedValue({} as never);
      mockRepo.getDatabaseSize.mockResolvedValue(null as never);

      await adminService.getDbHealth();

      expect(mockRepo.getTableCounts).toHaveBeenCalledOnce();
      expect(mockRepo.getDatabaseSize).toHaveBeenCalledOnce();
    });

    it("handles null dbSize from getDatabaseSize", async () => {
      mockRepo.getTableCounts.mockResolvedValue({} as never);
      mockRepo.getDatabaseSize.mockResolvedValue(null as never);

      const result = await adminService.getDbHealth();

      expect(result.dbSize).toBeNull();
    });
  });
});
