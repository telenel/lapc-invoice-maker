"use client";

import { useEffect, useState } from "react";
import { formatAmount, getInitials } from "@/lib/formatters";

interface UserActivity {
  id: string;
  name: string;
  invoiceCount: number;
  totalAmount: number;
}

export function UserActivityStrip() {
  const [users, setUsers] = useState<UserActivity[]>([]);

  useEffect(() => {
    fetch("/api/invoices?statsOnly=true&groupBy=creator")
      .then((r) => r.ok ? r.json() : { users: [] })
      .then((data) => setUsers(data.users || []))
      .catch(() => {});
  }, []);

  if (users.length === 0) return null;

  return (
    <div className="flex gap-3 overflow-x-auto pb-1">
      {users.map((user) => (
        <div
          key={user.id}
          className="flex items-center gap-2 px-3 py-2 bg-muted/30 rounded-lg shrink-0"
        >
          <div className="flex items-center justify-center w-6 h-6 rounded-md bg-muted text-[8px] font-bold text-muted-foreground">
            {getInitials(user.name)}
          </div>
          <div>
            <p className="text-[11px] font-semibold whitespace-nowrap">{user.name}</p>
            <p className="text-[10px] text-muted-foreground whitespace-nowrap">
              {user.invoiceCount} inv · {formatAmount(user.totalAmount)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
