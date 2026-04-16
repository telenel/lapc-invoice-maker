"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { archiveApi } from "@/domains/archive/api-client";
import { useInvoice } from "@/domains/invoice/hooks";
import { formatAmount, formatDateLong as formatDate } from "@/lib/formatters";
import { useSSE } from "@/lib/use-sse";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { openRegisterPrintWindow } from "@/components/shared/register-print-view";
import { InvoiceDetailHeader } from "./invoice-detail-header";
import { InvoiceDetailInfo } from "./invoice-detail-info";
import { InvoiceDetailStaff } from "./invoice-detail-staff";
import { InvoiceDetailItems } from "./invoice-detail-items";

export function InvoiceDetailView({ id }: { id: string }) {
  const router = useRouter();
  const { data: session } = useSession();
  const { data: invoice, loading, refetch } = useInvoice(id);
  useSSE("invoice-changed", refetch);
  const [regenerating, setRegenerating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const duplicatingRef = useRef(false);
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
        try {
          await refetch();
        } catch (refetchError) {
          // Log refetch errors but don't show failure toast since finalize succeeded
          console.error("Failed to refetch invoice after regeneration:", refetchError);
        }
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
      `${invoice.staff?.name ? "Staff" : "Requested by"}: ${invoice.staff?.name ?? invoice.contact?.name ?? "N/A"}\n` +
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
        toast.error(data.error ?? "Failed to move invoice to the Deleted Archive");
      } else {
        toast.success("Invoice moved to the Deleted Archive");
        router.push("/invoices");
      }
    } catch {
      toast.error("Failed to move invoice to the Deleted Archive");
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
    }
  }

  const handleDuplicate = useCallback(async () => {
    if (!invoice || duplicatingRef.current) return;
    duplicatingRef.current = true;
    setDuplicating(true);
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/duplicate`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Failed to duplicate");
        return;
      }
      const data = await res.json();
      toast.success(`Draft created from ${invoice.invoiceNumber ?? "invoice"}`);
      router.push(data.redirectTo);
    } catch {
      toast.error("Failed to duplicate");
    } finally {
      duplicatingRef.current = false;
      setDuplicating(false);
    }
  }, [invoice, router]);

  async function handleRestore() {
    if (!invoice) return;
    setRestoring(true);
    try {
      await archiveApi.restore(invoice.id);
      toast.success("Invoice restored");
      await refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to restore invoice");
    } finally {
      setRestoring(false);
    }
  }

  function handleDeleteClick() {
    if (!invoice) return;
    setDeleteDialogOpen(true);
  }

  function handlePrintForRegister() {
    if (!invoice) return;
    const taxRate = invoice.taxEnabled ? Number(invoice.taxRate) : 0;
    const subtotal = invoice.items.reduce((sum, item) => sum + Number(item.extendedPrice), 0);
    const taxableTotal = invoice.items
      .filter((item) => item.isTaxable)
      .reduce((sum, item) => sum + Number(item.extendedPrice), 0);
    const taxAmount = taxableTotal * taxRate;

    openRegisterPrintWindow({
      documentNumber: invoice.invoiceNumber || invoice.runningTitle || "Draft Invoice",
      documentType: "Invoice",
      status: invoice.status,
      date: formatDate(invoice.date),
      staffName: invoice.staff?.name ?? invoice.creatorName,
      department: invoice.department,
      items: invoice.items.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        extendedPrice: item.extendedPrice,
        sku: item.sku,
      })),
      subtotal,
      taxAmount,
      total: subtotal + taxAmount,
    });
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <div className="skeleton h-8 w-48" />
          <div className="skeleton h-4 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[0, 1].map((i) => (
            <div key={i} className="rounded-xl border border-border/40 bg-card p-5 space-y-3">
              <div className="skeleton h-4 w-32" />
              {[0, 1, 2, 3].map((j) => (
                <div key={j} className="flex justify-between">
                  <div className="skeleton h-3 w-20" />
                  <div className="skeleton h-3 w-24" />
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-border/40 bg-card p-5 space-y-3">
          <div className="skeleton h-4 w-24" />
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex justify-between">
              <div className="skeleton h-3 w-40" />
              <div className="skeleton h-3 w-16" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!invoice) {
    return <p className="text-muted-foreground text-sm">Invoice not found.</p>;
  }

  const sessionUser = session?.user as { id?: string; role?: string } | undefined;
  const canManageActions =
    sessionUser?.role === "admin" || (sessionUser?.id != null && sessionUser.id === invoice.creatorId);
  const isArchived = Boolean(invoice.archivedAt);

  return (
    <div className="space-y-6">
      {isArchived && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="flex flex-col gap-3 py-4 text-sm text-amber-950 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="font-medium">This invoice is in the Deleted Archive.</p>
              <p className="text-amber-900/80">
                {invoice.archivedBy?.name
                  ? `Deleted by ${invoice.archivedBy.name}.`
                  : "Restore it whenever you need it."}
              </p>
            </div>
            {canManageActions && (
              <Button size="sm" variant="outline" onClick={handleRestore} disabled={restoring}>
                {restoring ? "Restoring…" : "Restore"}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <InvoiceDetailHeader
        invoice={invoice}
        canManageActions={canManageActions && !isArchived}
        regenerating={regenerating}
        deleting={deleting}
        duplicating={duplicating}
        deleteDialogOpen={deleteDialogOpen}
        onDeleteDialogOpenChange={setDeleteDialogOpen}
        onDownloadPdf={() => window.open(`/api/invoices/${id}/pdf`, "_blank")}
        onRegeneratePdf={handleRegeneratePdf}
        onEmail={handleEmail}
        onDeleteClick={handleDeleteClick}
        onDeleteConfirm={handleDelete}
        onDuplicate={handleDuplicate}
        onPrintForRegister={handlePrintForRegister}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 page-enter page-enter-2">
        <InvoiceDetailInfo invoice={invoice} />
        <InvoiceDetailStaff staff={invoice.staff} contact={invoice.contact} />
      </div>

      <InvoiceDetailItems
        items={invoice.items}
        totalAmount={invoice.totalAmount}
        marginEnabled={invoice.marginEnabled}
        marginPercent={invoice.marginPercent}
        taxEnabled={invoice.taxEnabled}
        taxRate={invoice.taxRate}
      />
    </div>
  );
}
