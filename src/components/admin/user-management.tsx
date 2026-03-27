"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface User {
  id: string;
  username: string;
  name: string;
  email: string;
  accessCode: string | null;
  role: string;
  active: boolean;
  createdAt: string;
}

export function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState("user");
  const [resetCodeUser, setResetCodeUser] = useState<User | null>(null);
  const [resetedCode, setResetedCode] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/users");
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  async function handleCreate() {
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName, email: newEmail }),
    });
    if (res.ok) {
      const created = await res.json();
      setGeneratedCode(created.accessCode);
      setUsers((prev) => [created, ...prev]);
    }
  }

  function handleCloseCreate() {
    setCreateOpen(false);
    setNewName("");
    setNewEmail("");
    setGeneratedCode(null);
  }

  function openEdit(user: User) {
    setEditUser(user);
    setEditName(user.name);
    setEditEmail(user.email);
    setEditRole(user.role);
  }

  async function handleEdit() {
    if (!editUser) return;
    const res = await fetch(`/api/admin/users/${editUser.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName, email: editEmail, role: editRole }),
    });
    if (res.ok) {
      const updated = await res.json();
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      setEditUser(null);
    }
  }

  async function handleResetCode(user: User) {
    setResetCodeUser(user);
    setResetedCode(null);
    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resetCode: true }),
    });
    if (res.ok) {
      const updated = await res.json();
      setResetedCode(updated.accessCode);
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
    }
  }

  async function handleDeactivate(id: string) {
    if (!confirm("Are you sure you want to deactivate this user?")) return;
    const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    if (res.ok) {
      setUsers((prev) =>
        prev.map((u) => (u.id === id ? { ...u, active: false } : u))
      );
    }
  }

  if (loading) {
    return <p className="text-center py-8 text-muted-foreground">Loading users…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">User Management</h1>
        <Dialog open={createOpen} onOpenChange={(open) => {
          if (!open) handleCloseCreate();
          else setCreateOpen(true);
        }}>
          <DialogTrigger render={<Button>Generate Code</Button>} />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create User with Access Code</DialogTitle>
              <DialogDescription>
                Enter the user details. A 6-digit login code will be generated automatically.
              </DialogDescription>
            </DialogHeader>
            {generatedCode ? (
              <div className="space-y-4 py-4">
                <p className="text-sm text-muted-foreground">
                  User created successfully. Share this code with them:
                </p>
                <div className="text-center">
                  <span className="text-4xl font-mono font-bold tracking-widest">
                    {generatedCode}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  This code can be used to sign in without a password.
                </p>
              </div>
            ) : (
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="user-create-name">Name</Label>
                  <Input
                    id="user-create-name"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Full name…"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="user-create-email">Email</Label>
                  <Input
                    id="user-create-email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="Email (optional)…"
                    type="email"
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              {generatedCode ? (
                <Button onClick={handleCloseCreate}>Done</Button>
              ) : (
                <Button onClick={handleCreate} disabled={!newName.trim()}>
                  Generate Code
                </Button>
              )}
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
            <TableHead>Access Code</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.id} className={!user.active ? "opacity-50" : ""}>
              <TableCell className="font-medium">{user.name}</TableCell>
              <TableCell>{user.username}</TableCell>
              <TableCell>{user.email || "-"}</TableCell>
              <TableCell>
                {user.accessCode ? (
                  <code className="text-sm font-mono">{user.accessCode}</code>
                ) : (
                  "-"
                )}
              </TableCell>
              <TableCell>
                <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                  {user.role}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant={user.active ? "default" : "outline"}>
                  {user.active ? "Active" : "Inactive"}
                </Badge>
              </TableCell>
              <TableCell className="text-right space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openEdit(user)}
                >
                  Edit
                </Button>
                {user.active && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleResetCode(user)}
                  >
                    Reset Code
                  </Button>
                )}
                {user.active && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeactivate(user.id)}
                  >
                    Deactivate
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Reset Code dialog */}
      <Dialog open={!!resetCodeUser} onOpenChange={(open) => { if (!open) { setResetCodeUser(null); setResetedCode(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Access Code</DialogTitle>
            <DialogDescription>
              {resetedCode
                ? `A new access code has been generated for ${resetCodeUser?.name}.`
                : `Generating a new access code for ${resetCodeUser?.name}…`}
            </DialogDescription>
          </DialogHeader>
          {resetedCode && (
            <div className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground">
                Share this new code with the user. They will be prompted to set their own code on next login.
              </p>
              <div className="text-center">
                <span className="text-4xl font-mono font-bold tracking-widest">
                  {resetedCode}
                </span>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                This is a temporary code — the user will choose a permanent one after signing in.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => { setResetCodeUser(null); setResetedCode(null); }}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editUser} onOpenChange={(open) => { if (!open) setEditUser(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user details.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="user-edit-name">Name</Label>
              <Input
                id="user-edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-edit-email">Email</Label>
              <Input
                id="user-edit-email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                type="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-edit-role">Role</Label>
              <Select
                value={editRole || null}
                onValueChange={(v) => setEditRole(v ?? "user")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>
              Cancel
            </Button>
            <Button onClick={handleEdit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
