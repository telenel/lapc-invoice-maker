"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { adminApi } from "@/domains/admin/api-client";
import type {
  UserResponse,
  UserWithTemporaryPasswordResponse,
} from "@/domains/admin/types";

type User = UserResponse;
type CreatedUser = UserWithTemporaryPasswordResponse;
type TemporaryCredentials = {
  username: string;
  password: string;
  subjectName: string;
  actionLabel: "created" | "reset";
};

function stripTemporaryPassword(user: CreatedUser): User {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    email: user.email,
    role: user.role,
    active: user.active,
    setupComplete: user.setupComplete,
    createdAt: user.createdAt,
  };
}

export function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [newName, setNewName] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState("user");
  const [temporaryCredentials, setTemporaryCredentials] = useState<TemporaryCredentials | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    confirmLabel: string;
    variant: "destructive" | "default";
    onConfirm: () => Promise<void>;
  }>({
    open: false,
    title: "",
    description: "",
    confirmLabel: "Confirm",
    variant: "default",
    onConfirm: async () => {},
  });

  const fetchUsers = useCallback(async () => {
    try {
      const data = await adminApi.listUsers();
      setUsers(data);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  async function handleCreate() {
    if (isCreating) return;
    try {
      setIsCreating(true);
      setCreateError(null);
      const created = await adminApi.createUser({ name: newName });
      const safeUser = stripTemporaryPassword(created);
      setUsers((prev) => [safeUser, ...prev]);
      handleCloseCreate();
      setTemporaryCredentials({
        username: safeUser.username,
        password: created.temporaryPassword,
        subjectName: safeUser.name,
        actionLabel: "created",
      });
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create user");
    } finally {
      setIsCreating(false);
    }
  }

  function handleCloseCreate() {
    setCreateOpen(false);
    setNewName("");
    setCreateError(null);
  }

  async function copyCredentials(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error(`Failed to copy ${label.toLowerCase()}`);
    }
  }

  async function copyCredentialBundle() {
    if (!temporaryCredentials) return;
    const bundle = `Username: ${temporaryCredentials.username}\nPassword: ${temporaryCredentials.password}`;
    await copyCredentials(bundle, "Credentials");
  }

  function openEdit(user: User) {
    setEditUser(user);
    setEditName(user.name);
    setEditEmail(user.email ?? "");
    setEditRole(user.role);
  }

  async function handleEdit() {
    if (!editUser) return;
    try {
      const updated = await adminApi.updateUser(editUser.id, { name: editName, email: editEmail, role: editRole });
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      setEditUser(null);
    } catch { /* ignore */ }
  }

  function handleResetPassword(user: User) {
    setConfirmDialog({
      open: true,
      title: "Reset Password",
      description: `Reset password for ${user.name}? They will need to complete account setup again.`,
      confirmLabel: "Reset Password",
      variant: "destructive",
      onConfirm: async () => {
        try {
          const updated = await adminApi.resetUserPassword(user.id);
          const safeUser = stripTemporaryPassword(updated);
          setUsers((prev) => prev.map((u) => (u.id === safeUser.id ? safeUser : u)));
          setTemporaryCredentials({
            username: safeUser.username,
            password: updated.temporaryPassword,
            subjectName: user.name,
            actionLabel: "reset",
          });
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Failed to reset password");
        }
      },
    });
  }

  function handleDelete(id: string) {
    setConfirmDialog({
      open: true,
      title: "Delete User",
      description: "Are you sure you want to permanently delete this user? This cannot be undone.",
      confirmLabel: "Delete",
      variant: "destructive",
      onConfirm: async () => {
        try {
          await adminApi.deleteUser(id);
          setUsers((prev) => prev.filter((u) => u.id !== id));
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Failed to delete user");
        }
      },
    });
  }

  if (loading) return <p className="text-center py-8 text-muted-foreground">Loading users...</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">User Management</h1>
        <Dialog open={createOpen} onOpenChange={(open) => { if (!open) handleCloseCreate(); else setCreateOpen(true); }}>
          <DialogTrigger render={<Button>Create User</Button>} />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New User</DialogTitle>
              <DialogDescription>
                Enter the user&apos;s full name. They&apos;ll log in with a temporary username and temporary password.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="user-create-name">Full Name</Label>
                <Input id="user-create-name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Jane Smith" />
              </div>
              {createError && (
                <p className="text-sm text-destructive">{createError}</p>
              )}
            </div>
            <DialogFooter>
              <Button onClick={handleCreate} disabled={!newName.trim() || isCreating}>Create User</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Username</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.id} className={!user.active ? "opacity-50" : ""}>
              <TableCell className="font-medium">{user.name}</TableCell>
              <TableCell className="font-mono text-sm">{user.username}</TableCell>
              <TableCell>{user.email || "-"}</TableCell>
              <TableCell>
                <Badge variant={user.role === "admin" ? "default" : "secondary"}>{user.role}</Badge>
              </TableCell>
              <TableCell>
                {!user.active ? (
                  <Badge variant="outline">Inactive</Badge>
                ) : !user.setupComplete ? (
                  <Badge variant="secondary">Pending Setup</Badge>
                ) : (
                  <Badge variant="default">Active</Badge>
                )}
              </TableCell>
              <TableCell className="text-right space-x-2">
                <Button variant="outline" size="sm" onClick={() => openEdit(user)}>Edit</Button>
                {user.active && (
                  <Button variant="outline" size="sm" onClick={() => handleResetPassword(user)}>Reset Password</Button>
                )}
                <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleDelete(user.id)}>Delete</Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Edit dialog */}
      <Dialog open={!!editUser} onOpenChange={(open) => { if (!open) setEditUser(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Update user details.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="user-edit-name">Name</Label>
              <Input id="user-edit-name" value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-edit-email">Email</Label>
              <Input id="user-edit-email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} type="email" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-edit-role">Role</Label>
              <Select value={editRole || null} onValueChange={(v) => setEditRole(v ?? "user")}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>Cancel</Button>
            <Button onClick={handleEdit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        {...confirmDialog}
        onOpenChange={(open) => setConfirmDialog((prev) => ({ ...prev, open }))}
      />

      <Dialog open={!!temporaryCredentials} onOpenChange={(open) => { if (!open) setTemporaryCredentials(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Temporary Credentials</DialogTitle>
            <DialogDescription>
              {temporaryCredentials
                ? `${temporaryCredentials.subjectName} was ${temporaryCredentials.actionLabel}. Share these credentials before closing this dialog.`
                : "Share these credentials before closing this dialog."}
            </DialogDescription>
          </DialogHeader>
          {temporaryCredentials && (
            <div className="space-y-4 py-4">
              <div className="rounded-lg bg-muted p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Username</p>
                    <p className="font-mono text-sm break-all">{temporaryCredentials.username}</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => copyCredentials(temporaryCredentials.username, "Username")}>
                    Copy
                  </Button>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Temporary Password</p>
                    <p className="font-mono text-sm break-all">{temporaryCredentials.password}</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => copyCredentials(temporaryCredentials.password, "Password")}>
                    Copy
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                The password is only shown now. Once the user signs in and completes setup, it will no longer be recoverable from the hashed value.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={copyCredentialBundle} disabled={!temporaryCredentials}>
              Copy Both
            </Button>
            <Button onClick={() => setTemporaryCredentials(null)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
