import { InvoiceTable } from "@/components/invoices/invoice-table";

export default function InvoicesPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-balance">Invoices</h1>
      <InvoiceTable />
    </div>
  );
}
