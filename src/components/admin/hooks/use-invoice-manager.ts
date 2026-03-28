"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";

export type InvoiceStatus = "DRAFT" | "FINAL" | "PENDING_CHARGE";

export interface Invoice {
  id: string;
  invoiceNumber: string | null;
  date: string;
  department: string;
  category: string;
  totalAmount: string | number;
  status: InvoiceStatus;
  isRecurring: boolean;
  accountNumber?: string | null;
  accountCode?: string | null;
  notes?: string | null;
  createdAt: string;
  staff: { id: string; name: string; title: string; department: string };
  creator: { id: string; name: string; username: string };
}

interface ApiResponse {
  invoices: Invoice[];
  total: number;
  page: number;
  pageSize: number;
}

export const PAGE_SIZE = 20;

export interface InvoiceManagerState {
  invoices: Invoice[];
  total: number;
  page: number;
  loading: boolean;
  search: string;
  statusFilter: InvoiceStatus | "ALL";
  totalPages: number;
  setPage: (page: number | ((p: number) => number)) => void;
  handleSearchChange: (value: string) => void;
  handleStatusFilterChange: (value: string | null) => void;
  setInvoices: React.Dispatch<React.SetStateAction<Invoice[]>>;
  setTotal: React.Dispatch<React.SetStateAction<number>>;
  refetch: () => void;
}

export function useInvoiceManager(): InvoiceManagerState {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | "ALL">("ALL");

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });
      if (search.trim()) params.set("search", search.trim());
      if (statusFilter !== "ALL") params.set("status", statusFilter);

      const res = await fetch(`/api/invoices?${params}`);
      if (!res.ok) throw new Error("Failed to fetch invoices");
      const data: ApiResponse = await res.json();
      setInvoices(data.invoices);
      setTotal(data.total);
    } catch {
      toast.error("Failed to load invoices");
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  function handleSearchChange(value: string) {
    setSearch(value);
    setPage(1);
  }

  function handleStatusFilterChange(value: string | null) {
    setStatusFilter((value ?? "ALL") as InvoiceStatus | "ALL");
    setPage(1);
  }

  return {
    invoices,
    total,
    page,
    loading,
    search,
    statusFilter,
    totalPages,
    setPage,
    handleSearchChange,
    handleStatusFilterChange,
    setInvoices,
    setTotal,
    refetch: fetchInvoices,
  };
}
