import { InvoiceDetailView } from "@/components/invoices/invoice-detail";

export default function InvoiceDetailPage({
  params,
}: {
  params: { id: string };
}) {
  return <InvoiceDetailView id={params.id} />;
}
