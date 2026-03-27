"use client";

import { useState, useEffect, useCallback } from "react";
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

interface User {
  id: string;
  username: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  setupComplete: boolean;
  createdAt: string;
}

export function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [newName, setNewName] = useState("");
  const [createdUsername, setCreatedUsername] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState("user");

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/users");
      if (res.ok) setUsers(await res.json());
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  async function handleCreate() {
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName }),
    });
    if (res.ok) {
      const created = await res.json();
      setCreatedUsername(created.username);
      setUsers((prev) => [created, ...prev]);
    }
  }

  function handleCloseCreate() {
    setCreateOpen(false);
    setNewName("");
    setCreatedUsername(null);
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

  async function handleResetPassword(user: User) {
    if (!confirm(`Reset password for ${user.name}? They will need to go through onboarding again.`)) return;
    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resetPassword: true }),
    });
    if (res.ok) {
      const updated = await res.json();
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      alert(`Password reset. Tell ${user.name} to log in as "${updated.username}" with password "password123".`);
    }
  }

  async function handleDeactivate(id: string) {
    if (!confirm("Are you sure you want to deactivate this user?")) return;
    const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    if (res.ok) {
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, active: false } : u)));
    }
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
                Enter the user&apos;s full name. They&apos;ll log in with a temporary username and default password.
              </DialogDescription>
            </DialogHeader>
            {createdUsername ? (
              <div className="space-y-4 py-4">
                <p className="text-sm text-muted-foreground">User created successfully. Share these credentials:</p>
                <div className="rounded-lg bg-muted p-4 space-y-2">
                  <p className="text-sm"><span className="text-muted-foreground">Username:</span> <strong className="font-mono">{createdUsername}</strong></p>
                  <p className="text-sm"><span className="text-muted-foreground">Password:</span> <strong className="font-mono">password123</strong></p>
                </div>
                <p className="text-xs text-muted-foreground">They&apos;ll be prompted to set up their profile on first login.</p>
              </div>
            ) : (
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="user-create-name">Full Name</Label>
                  <Input id="user-create-name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Jane Smith" />
                </div>
              </div>
            )}
            <DialogFooter>
              {createdUsername ? (
                <Button onClick={handleCloseCreate}>Done</Button>
              ) : (
                <Button onClick={handleCreate} disabled={!newName.trim()}>Create User</Button>
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
                {user.active && (
                  <Button variant="outline" size="sm" onClick={() => handleDeactivate(user.id)}>Deactivate</Button>
                )}
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
    </div>
  );
}
