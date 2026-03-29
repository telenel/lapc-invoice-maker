"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useInvoice } from "@/domains/invoice/hooks";
import { formatAmount, formatDateLong as formatDate } from "@/lib/formatters";
import { InvoiceDetailHeader } from "./invoice-detail-header";
import { InvoiceDetailInfo } from "./invoice-detail-info";
import { InvoiceDetailStaff } from "./invoice-detail-staff";
import { InvoiceDetailItems } from "./invoice-detail-items";

export function InvoiceDetailView({ id }: { id: string }) {
  const router = useRouter();
  const { data: invoice, loading } = useInvoice(id);
  const [regenerating, setRegenerating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  async function handleRegeneratePdf() {
    if (!invoice) return;
    setRegenerating(true);
    try {
      const res = await fetch(`/api/invoices/${id}/finalize`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Failed to regenerate PDF");
      } else {
        toast.success("PDF regenerated successfully");
      }
    } catch {
      toast.error("Failed to regenerate PDF");
    } finally {
      setRegenerating(false);
    }
  }

  function handleEmail() {
    if (!invoice) return;
    window.open(`/api/invoices/${id}/pdf`, "_blank");
    const subject = encodeURIComponent(
      `Invoice ${invoice.invoiceNumber} Ready for Processing — ${invoice.department}`
    );
    const body = encodeURIComponent(
      `Invoice ${invoice.invoiceNumber} is ready for processing. Please find the attached invoice.\n\n` +
      `Department: ${invoice.department}\n` +
      `${invoice.staff?.name ? "Staff" : "Contact"}: ${invoice.staff?.name ?? invoice.contact?.name ?? "N/A"}\n` +
      `Account Number: ${invoice.accountNumber || "N/A"}\n` +
      `Account Code: ${invoice.accountCode || "N/A"}\n` +
      `Amount: ${formatAmount(invoice.totalAmount)}\n` +
      `Date: ${formatDate(invoice.date)}\n\n` +
      `Thank you,\n${invoice.creatorName}`
    );
    setTimeout(() => {
      window.location.href = `mailto:?subject=${subject}&body=${body}`;
    }, 500);
    toast.info("PDF downloaded — attach it to the email");
  }

  async function handleDelete() {
    if (!invoice) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/invoices/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Failed to delete invoice");
      } else {
        toast.success("Invoice deleted");
        router.push("/invoices");
      }
    } catch {
      toast.error("Failed to delete invoice");
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
    }
  }

  function handleDeleteClick() {
    if (!invoice) return;
    if (invoice.status === "DRAFT" || invoice.status === "PENDING_CHARGE") {
      if (window.confirm("Are you sure you want to delete this draft invoice?")) {
        handleDelete();
      }
    } else {
      setDeleteDialogOpen(true);
    }
  }

  if (loading) {
    return <p className="text-muted-foreground text-sm">Loading…</p>;
  }

  if (!invoice) {
    return <p className="text-muted-foreground text-sm">Invoice not found.</p>;
  }

  return (
    <div className="space-y-6">
      <InvoiceDetailHeader
        invoice={invoice}
        regenerating={regenerating}
        deleting={deleting}
        deleteDialogOpen={deleteDialogOpen}
        onDeleteDialogOpenChange={setDeleteDialogOpen}
        onDownloadPdf={() => window.open(`/api/invoices/${id}/pdf`, "_blank")}
        onRegeneratePdf={handleRegeneratePdf}
        onEmail={handleEmail}
        onDeleteClick={handleDeleteClick}
        onDeleteConfirm={handleDelete}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <InvoiceDetailInfo invoice={invoice} />
        <InvoiceDetailStaff staff={invoice.staff} contact={invoice.contact} />
      </div>

      <InvoiceDetailItems items={invoice.items} totalAmount={invoice.totalAmount} />
    </div>
  );
}
