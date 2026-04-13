"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TimeSelect } from "@/components/ui/time-select";
import { LinkIcon, MoreHorizontalIcon, PrinterIcon } from "lucide-react";
import { escapeHtml } from "@/lib/html";
import { formatAmount, formatDateLong as formatDate } from "@/lib/formatters";
import { formatLosAngelesDate, formatWallClockTime } from "@/lib/time";
import { useSSE } from "@/lib/use-sse";
import { ShareLinkDialog } from "@/components/quotes/share-link-dialog";
import { QuoteActivity } from "@/components/quotes/quote-activity";
import { FollowUpBadge } from "@/components/follow-up/follow-up-badge";
import { RequestAccountDialog } from "@/components/follow-up/request-account-dialog";
import { useFollowUpBadge } from "@/domains/follow-up/hooks";
import type { FollowUpBadgeState } from "@/domains/follow-up/types";
import { getMissingCustomerCateringRequirements } from "@/domains/quote/catering";
import { QUOTE_PAYMENT_METHODS } from "@/domains/quote/payment";
import type { CateringDetails } from "@/domains/quote/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface QuoteItem {
  id: string;
  description: string;
  quantity: string | number;
  unitPrice: string | number;
  extendedPrice: string | number;
  isTaxable: boolean;
  sortOrder: number;
  costPrice: string | number | null;
  marginOverride: number | null;
}

interface Quote {
  id: string;
  quoteNumber: string | null;
  quoteStatus: "DRAFT" | "SENT" | "SUBMITTED_EMAIL" | "SUBMITTED_MANUAL" | "ACCEPTED" | "DECLINED" | "REVISED" | "EXPIRED";
  category: string;
  date: string;
  createdAt: string;
  department: string;
  accountCode: string;
  accountNumber: string;
  totalAmount: string | number;
  notes: string | null;
  expirationDate: string | null;
  recipientName: string | null;
  recipientEmail: string | null;
  recipientOrg: string | null;
  shareToken: string | null;
  staff: {
    id: string;
    name: string;
    title: string;
    department: string;
    extension: string | null;
    email: string | null;
  } | null;
  contact: {
    id: string;
    name: string;
    title: string;
    org: string;
    department: string;
    email: string;
    phone: string;
  } | null;
  creatorName: string;
  items: QuoteItem[];
  isCateringEvent: boolean;
  cateringDetails: unknown;
  marginEnabled: boolean;
  marginPercent: number | null;
  taxEnabled: boolean;
  taxRate: number;
  paymentMethod: string | null;
  paymentAccountNumber: string | null;
  paymentDetailsResolved: boolean;
  paymentFollowUpBadge?: FollowUpBadgeState | null;
  viewerAccess?: {
    canViewQuote: boolean;
    canManageActions: boolean;
    canViewActivity: boolean;
    canViewSensitiveFields: boolean;
  };
  convertedToInvoice: {
    id: string;
    invoiceNumber: string | null;
  } | null;
  revisedFromQuote?: { id: string; quoteNumber: string | null } | null;
  revisedToQuote?: { id: string; quoteNumber: string | null } | null;
}

type QuoteStatus = Quote["quoteStatus"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function expirationText(dateStr: string): string {
  const exp = new Date(dateStr);
  const now = new Date();
  const diffMs = exp.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays > 0) return `Expires in ${diffDays} day${diffDays !== 1 ? "s" : ""}`;
  if (diffDays === 0) return "Expires today";
  return `Expired ${Math.abs(diffDays)} day${Math.abs(diffDays) !== 1 ? "s" : ""} ago`;
}

const statusBadgeVariant: Record<
  QuoteStatus,
  "outline" | "secondary" | "default" | "destructive"
> = {
  DRAFT: "outline",
  SENT: "secondary",
  SUBMITTED_EMAIL: "secondary",
  SUBMITTED_MANUAL: "secondary",
  ACCEPTED: "default",
  DECLINED: "destructive",
  REVISED: "outline",
  EXPIRED: "outline",
};

const statusLabel: Record<QuoteStatus, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  SUBMITTED_EMAIL: "Sent (Email)",
  SUBMITTED_MANUAL: "Sent (Manual)",
  ACCEPTED: "Accepted",
  DECLINED: "Declined",
  REVISED: "Revised",
  EXPIRED: "Expired",
};

const MANUAL_APPROVAL_PAYMENT_OPTIONS = QUOTE_PAYMENT_METHODS.map((value) => ({
  value,
  label:
    value === "ACCOUNT_NUMBER"
      ? "Account Number"
      : value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()),
}));

type ManualApprovalCateringForm = {
  eventDate: string;
  startTime: string;
  endTime: string;
  contactName: string;
  contactPhone: string;
  location: string;
  setupRequired: boolean;
  setupTime: string;
  takedownRequired: boolean;
  takedownTime: string;
  specialInstructions: string;
};

type GuideField = {
  label: string;
  value: string;
};

type GuideSection = {
  title: string;
  fields: GuideField[];
};

function makeManualApprovalCateringForm(existing: CateringDetails | null): ManualApprovalCateringForm {
  return {
    eventDate: existing?.eventDate ?? "",
    startTime: existing?.startTime ?? "",
    endTime: existing?.endTime ?? "",
    contactName: existing?.contactName ?? "",
    contactPhone: existing?.contactPhone ?? "",
    location: existing?.location ?? "",
    setupRequired: existing?.setupRequired ?? false,
    setupTime: existing?.setupTime ?? "",
    takedownRequired: existing?.takedownRequired ?? false,
    takedownTime: existing?.takedownTime ?? "",
    specialInstructions: existing?.specialInstructions ?? "",
  };
}

function formatCateringDateTime(catering: CateringDetails): string | null {
  if (!catering.eventDate) return null;

  const dateStr = formatLosAngelesDate(catering.eventDate, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  if (!catering.startTime || !catering.endTime) return dateStr;

  return `${dateStr}, ${formatWallClockTime(catering.startTime)} \u2013 ${formatWallClockTime(catering.endTime)}`;
}

function addGuideField(fields: GuideField[], label: string, value: string | number | null | undefined) {
  if (value == null) return;
  const normalized = String(value).trim();
  if (!normalized) return;
  fields.push({ label, value: normalized });
}

function joinGuideValues(
  values: Array<string | null | undefined>,
  separator = " · ",
): string {
  return values
    .map((value) => value?.trim() ?? "")
    .filter(Boolean)
    .join(separator);
}

function buildGuideMultilineValue(values: Array<string | null | undefined>): string {
  return values
    .map((value) => value?.trim() ?? "")
    .filter(Boolean)
    .join("\n");
}

function formatGuideServiceWindow(catering: CateringDetails): string {
  if (catering.startTime && catering.endTime) {
    return `${formatWallClockTime(catering.startTime)} – ${formatWallClockTime(catering.endTime)}`;
  }
  if (catering.startTime) {
    return `Starts at ${formatWallClockTime(catering.startTime)}`;
  }
  if (catering.endTime) {
    return `Ends at ${formatWallClockTime(catering.endTime)}`;
  }
  return "Pending customer confirmation";
}

function formatGuideOperationLine(args: {
  enabled: boolean;
  time?: string;
  instructions?: string;
}): string {
  if (!args.enabled) {
    return "Not required";
  }

  return joinGuideValues(
    [
      args.time ? `At ${formatWallClockTime(args.time)}` : "Time pending",
      args.instructions,
    ],
    " · ",
  );
}

function buildCateringGuidePendingItems(catering: CateringDetails): string[] {
  const pending: string[] = [];

  if (!catering.eventName?.trim()) pending.push("Event name");
  if (!catering.startTime?.trim()) pending.push("Service start time");
  if (!catering.endTime?.trim()) pending.push("Service end time");
  if (!catering.location?.trim()) pending.push("Event location");
  if (!catering.headcount) pending.push("Headcount");
  if (catering.setupRequired && !catering.setupTime?.trim()) pending.push("Setup time");
  if (catering.takedownRequired && !catering.takedownTime?.trim()) pending.push("Takedown time");

  return pending;
}

function buildCateringGuideSections(
  quote: Quote,
  catering: CateringDetails,
  showInternalFields: boolean,
): GuideSection[] {
  const quoteInfo: GuideField[] = [];
  addGuideField(quoteInfo, "Quote number", quote.quoteNumber ?? "Quote");
  addGuideField(quoteInfo, "Status", statusLabel[quote.quoteStatus]);
  addGuideField(quoteInfo, "Quote date", formatDate(quote.date));
  addGuideField(quoteInfo, "Expiration", quote.expirationDate ? formatDate(quote.expirationDate) : "");
  addGuideField(quoteInfo, "Prepared by", quote.creatorName);
  addGuideField(quoteInfo, "Department", quote.department);
  addGuideField(quoteInfo, "Category", quote.category);
  if (showInternalFields) {
    addGuideField(quoteInfo, "Account code", quote.accountCode);
    addGuideField(quoteInfo, "Account number", quote.accountNumber);
  }

  const recipient: GuideField[] = [];
  addGuideField(recipient, "Recipient", quote.recipientName);
  addGuideField(recipient, "Organization", quote.recipientOrg);
  addGuideField(recipient, "Recipient email", quote.recipientEmail);
  if (quote.staff?.name) {
    addGuideField(
      recipient,
      "Assigned staff",
      [quote.staff.name, quote.staff.title, quote.staff.email].filter(Boolean).join(" · "),
    );
  }

  const eventDetails: GuideField[] = [];
  addGuideField(eventDetails, "Event name", catering.eventName);
  addGuideField(
    eventDetails,
    "Event date",
    catering.eventDate
      ? formatLosAngelesDate(catering.eventDate, {
          month: "long",
          day: "numeric",
          year: "numeric",
        })
      : "",
  );
  addGuideField(eventDetails, "Start time", formatWallClockTime(catering.startTime));
  addGuideField(eventDetails, "End time", formatWallClockTime(catering.endTime));
  addGuideField(eventDetails, "Location", catering.location);
  addGuideField(
    eventDetails,
    "Headcount",
    catering.headcount != null ? `${catering.headcount} attendees` : "",
  );

  const contactDetails: GuideField[] = [];
  addGuideField(contactDetails, "Contact name", catering.contactName);
  addGuideField(contactDetails, "Contact phone", catering.contactPhone);
  addGuideField(contactDetails, "Contact email", catering.contactEmail);

  const logistics: GuideField[] = [];
  addGuideField(logistics, "Setup required", catering.setupRequired ? "Yes" : "No");
  if (catering.setupRequired) {
    addGuideField(logistics, "Setup time", formatWallClockTime(catering.setupTime));
    addGuideField(logistics, "Setup instructions", catering.setupInstructions);
  }
  addGuideField(logistics, "Takedown required", catering.takedownRequired ? "Yes" : "No");
  if (catering.takedownRequired) {
    addGuideField(logistics, "Takedown time", formatWallClockTime(catering.takedownTime));
    addGuideField(logistics, "Takedown instructions", catering.takedownInstructions);
  }
  addGuideField(logistics, "Special instructions", catering.specialInstructions);
  addGuideField(logistics, "Quote notes", quote.notes);

  return [
    { title: "Quote Information", fields: quoteInfo },
    { title: "Recipient", fields: recipient },
    { title: "Event Details", fields: eventDetails },
    { title: "Customer Contact", fields: contactDetails },
    { title: "Operations Notes", fields: logistics },
  ].filter((section) => section.fields.length > 0);
}

function buildCateringGuidePrintDocument(args: {
  quote: Quote;
  sections: GuideSection[];
  itemSubtotal: number;
  taxAmount: number;
  grandTotal: number;
}): string {
  const { quote, sections, itemSubtotal, taxAmount, grandTotal } = args;
  const catering = (quote.cateringDetails as CateringDetails | null) ?? null;
  const pendingItems = catering ? buildCateringGuidePendingItems(catering) : [];
  const headerTitle = catering?.eventName?.trim()
    || quote.quoteNumber
    || "Catering Guide";
  const summaryCards = catering
    ? [
        {
          label: "Event Date",
          value: catering.eventDate
            ? formatLosAngelesDate(catering.eventDate, {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric",
              })
            : "Pending customer confirmation",
        },
        {
          label: "Service Window",
          value: formatGuideServiceWindow(catering),
        },
        {
          label: "Location",
          value: catering.location?.trim() || "Pending customer confirmation",
        },
        {
          label: "Headcount",
          value: catering.headcount
            ? `${catering.headcount} attendees`
            : "Pending customer confirmation",
        },
        {
          label: "Day-of Contact",
          value:
            buildGuideMultilineValue([
              catering.contactName,
              catering.contactPhone,
              catering.contactEmail,
            ]) || "Pending customer confirmation",
        },
        {
          label: "Campus Contact",
          value:
            buildGuideMultilineValue([
              quote.staff?.name
                ? joinGuideValues(
                    [quote.staff.name, quote.staff.title, quote.staff.email],
                    " · ",
                  )
                : quote.creatorName,
              quote.recipientName,
              quote.recipientEmail,
            ]) || "LAPortal",
        },
      ]
    : [];
  const operationsCards = catering
    ? [
        {
          label: "Setup",
          value: formatGuideOperationLine({
            enabled: catering.setupRequired,
            time: catering.setupTime,
            instructions: catering.setupInstructions,
          }),
        },
        {
          label: "Takedown",
          value: formatGuideOperationLine({
            enabled: catering.takedownRequired,
            time: catering.takedownTime,
            instructions: catering.takedownInstructions,
          }),
        },
        {
          label: "Special Instructions",
          value: catering.specialInstructions?.trim() || "None provided",
        },
        {
          label: "Quote Notes",
          value: quote.notes?.trim() || "None provided",
        },
      ]
    : [];
  const summaryCardsHtml = summaryCards
    .map(
      (card) => `
        <article class="summary-card">
          <div class="summary-label">${escapeHtml(card.label)}</div>
          <div class="summary-value">${escapeHtml(card.value).replace(/\n/g, "<br />")}</div>
        </article>
      `,
    )
    .join("");
  const operationsCardsHtml = operationsCards
    .map(
      (card) => `
        <article class="summary-card summary-card--compact">
          <div class="summary-label">${escapeHtml(card.label)}</div>
          <div class="summary-value">${escapeHtml(card.value).replace(/\n/g, "<br />")}</div>
        </article>
      `,
    )
    .join("");
  const pendingItemsHtml = pendingItems.length > 0
    ? `
        <section class="guide-section attention-section">
          <h2>Pending Confirmation</h2>
          <p class="attention-copy">The following day-of details are still missing and should be confirmed before service:</p>
          <ul class="attention-list">
            ${pendingItems
              .map((item) => `<li>${escapeHtml(item)}</li>`)
              .join("")}
          </ul>
        </section>
      `
    : "";
  const sectionHtml = sections
    .map(
      (section) => `
        <section class="guide-section">
          <h2>${escapeHtml(section.title)}</h2>
          <dl>
            ${section.fields
              .map(
                (field) => `
                  <div class="guide-row">
                    <dt>${escapeHtml(field.label)}</dt>
                    <dd>${escapeHtml(field.value).replace(/\n/g, "<br />")}</dd>
                  </div>
                `,
              )
              .join("")}
          </dl>
        </section>
      `,
    )
    .join("");

  const itemsHtml = quote.items
    .map((item) => {
      return `
        <tr class="item-row">
          <td class="item-cell item-cell--description">
            <div class="item-title">${escapeHtml(item.description || "Line Item")}</div>
            <div class="item-meta">${escapeHtml(item.isTaxable ? "Taxable item" : "Non-taxable item")}</div>
          </td>
          <td class="item-cell item-cell--numeric">${escapeHtml(Number(item.quantity).toString())}</td>
          <td class="item-cell item-cell--numeric">${escapeHtml(formatAmount(item.unitPrice))}</td>
          <td class="item-cell item-cell--numeric">${escapeHtml(formatAmount(item.extendedPrice))}</td>
        </tr>
      `;
    })
    .join("");

  const totalRows = [
    { label: "Subtotal", value: formatAmount(itemSubtotal) },
    ...(quote.taxEnabled
      ? [{
          label: `Tax (${(quote.taxRate * 100).toFixed(2)}%)`,
          value: formatAmount(taxAmount),
        }]
      : []),
    { label: "Total", value: formatAmount(grandTotal) },
  ];

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(quote.quoteNumber ?? "Catering Guide")}</title>
    <style>
      @page { margin: 0.5in; }
      :root {
        color-scheme: light;
      }
      * {
        box-sizing: border-box;
      }
      body {
        margin: 0;
        font-family: Arial, Helvetica, sans-serif;
        color: #111827;
        background: #ffffff;
        line-height: 1.45;
        orphans: 3;
        widows: 3;
      }
      main {
        display: grid;
        gap: 16px;
      }
      header,
      .guide-section,
      .summary-grid,
      .operations-grid {
        break-inside: avoid-page;
        page-break-inside: avoid;
      }
      .page-header {
        border-bottom: 2px solid #111827;
        padding-bottom: 12px;
      }
      h1 {
        margin: 0 0 4px;
        font-size: 24px;
      }
      .subtitle {
        color: #4b5563;
        font-size: 12px;
      }
      .eyebrow {
        margin: 0 0 6px;
        color: #6b7280;
        font-size: 11px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .summary-grid,
      .operations-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
      }
      .summary-card {
        border: 1px solid #d1d5db;
        padding: 12px 14px;
        min-height: 86px;
      }
      .summary-card--compact {
        min-height: 0;
      }
      .summary-label {
        color: #6b7280;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
      }
      .summary-value {
        margin-top: 6px;
        font-size: 14px;
        font-weight: 600;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
      }
      .guide-section {
        border: 1px solid #d1d5db;
        padding: 14px 16px;
      }
      .guide-section h2 {
        margin: 0 0 10px;
        font-size: 14px;
        text-transform: uppercase;
        letter-spacing: 0.06em;
      }
      .guide-section dl {
        margin: 0;
        display: grid;
        gap: 8px;
      }
      .guide-row {
        display: grid;
        grid-template-columns: 150px 1fr;
        gap: 12px;
        align-items: start;
      }
      .guide-row dt {
        margin: 0;
        font-weight: 700;
      }
      .guide-row dd {
        margin: 0;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
      }
      .attention-section {
        border-color: #f59e0b;
        background: #fffbeb;
      }
      .attention-copy {
        margin: 0 0 8px;
      }
      .attention-list {
        margin: 0;
        padding-left: 18px;
      }
      .items-section {
        break-inside: auto;
        page-break-inside: auto;
      }
      .item-table {
        width: 100%;
        border-collapse: collapse;
      }
      .item-table thead {
        display: table-header-group;
      }
      .item-table th,
      .item-table td {
        padding: 10px 8px;
        border-bottom: 1px solid #e5e7eb;
        text-align: left;
        vertical-align: top;
      }
      .item-table th {
        font-size: 11px;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: #6b7280;
      }
      .item-row {
        break-inside: avoid-page;
        page-break-inside: avoid;
      }
      .item-title {
        font-weight: 700;
        white-space: normal;
        overflow-wrap: anywhere;
      }
      .item-meta {
        margin-top: 4px;
        color: #4b5563;
        font-size: 12px;
      }
      .item-cell--numeric {
        text-align: right;
        white-space: nowrap;
        width: 90px;
      }
      .totals-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: 6px;
      }
      .totals-list li:last-child {
        margin-top: 6px;
        padding-top: 8px;
        border-top: 1px solid #111827;
        font-weight: 700;
      }
      .totals-list li {
        display: flex;
        justify-content: space-between;
        gap: 12px;
      }
      @media print {
        .guide-section {
          break-inside: avoid-page;
        }
        .item-table tr {
          break-inside: avoid-page;
        }
      }
      @media (max-width: 720px) {
        .summary-grid,
        .operations-grid,
        .guide-row {
          grid-template-columns: 1fr;
        }
      }
    </style>
  </head>
  <body>
    <main>
      <header class="page-header">
        <div class="eyebrow">Day-of Catering Guide</div>
        <h1>${escapeHtml(headerTitle)}</h1>
        <div class="subtitle">Generated from live LAPortal quote data. This guide reflects the latest customer and staff updates available at print time.</div>
      </header>
      ${summaryCardsHtml
        ? `
          <section class="summary-grid" aria-label="Day-of summary">
            ${summaryCardsHtml}
          </section>
        `
        : ""}
      ${operationsCardsHtml
        ? `
          <section class="operations-grid" aria-label="Operations plan">
            ${operationsCardsHtml}
          </section>
        `
        : ""}
      ${pendingItemsHtml}
      ${sectionHtml}
      <section class="guide-section items-section">
        <h2>Ordered Items</h2>
        <table class="item-table" aria-label="Ordered items">
          <thead>
            <tr>
              <th scope="col">Item</th>
              <th scope="col">Qty</th>
              <th scope="col">Unit</th>
              <th scope="col">Line Total</th>
            </tr>
          </thead>
          <tbody>${itemsHtml}</tbody>
        </table>
      </section>
      <section class="guide-section">
        <h2>Pricing Summary</h2>
        <ul class="totals-list">
          ${totalRows
            .map(
              (row) => `
                <li>
                  <span>${escapeHtml(row.label)}</span>
                  <span>${escapeHtml(row.value)}</span>
                </li>
              `,
            )
            .join("")}
        </ul>
      </section>
    </main>
    <script>
      window.addEventListener("load", () => {
        window.print();
        setTimeout(() => window.close(), 150);
      });
    </script>
  </body>
</html>`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function QuoteDetailView({ id }: { id: string }) {
  const router = useRouter();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionState, setActionState] = useState({
    deleting: false,
    declining: false,
    sending: false,
    converting: false,
    revising: false,
    markingSubmitted: false,
    duplicating: false,
    approving: false,
    resolvingPayment: false,
  });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [declineDialogOpen, setDeclineDialogOpen] = useState(false);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [approvePaymentMethod, setApprovePaymentMethod] = useState("");
  const [approveAccountNumber, setApproveAccountNumber] = useState("");
  const [approveCateringForm, setApproveCateringForm] = useState<ManualApprovalCateringForm>(
    makeManualApprovalCateringForm(null),
  );
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentAccountNumber, setPaymentAccountNumber] = useState("");
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const { badge: followUpBadge, refresh: refreshBadge } = useFollowUpBadge(id);

  const fetchQuote = useCallback(async () => {
    try {
      const res = await fetch(`/api/quotes/${id}`);
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Failed to load quote");
        return;
      }
      const data: Quote = await res.json();
      setQuote(data);
    } catch {
      toast.error("Failed to load quote");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchQuote();
  }, [fetchQuote]);

  useSSE("quote-changed", fetchQuote);
  const pdfUrl = `/api/quotes/${id}/pdf`;

  const handleDelete = useCallback(async () => {
    if (!quote) return;
    setActionState((prev) => ({ ...prev, deleting: true }));
    try {
      const res = await fetch(`/api/quotes/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Failed to delete quote");
      } else {
        toast.success("Quote deleted");
        router.push("/quotes");
      }
    } catch {
      toast.error("Failed to delete quote");
    } finally {
      setActionState((prev) => ({ ...prev, deleting: false }));
      setDeleteDialogOpen(false);
    }
  }, [quote, id, router]);

  const handleMarkAsSent = useCallback(async () => {
    if (!quote) return;
    setActionState((prev) => ({ ...prev, sending: true }));
    try {
      const res = await fetch(`/api/quotes/${id}/send`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Failed to mark quote as sent");
      } else {
        const data = await res.json();
        toast.success("Quote marked as sent");
        setShareUrl(data.shareUrl);
        setShareDialogOpen(true);
        // Refresh quote data
        const refreshRes = await fetch(`/api/quotes/${id}`);
        if (refreshRes.ok) {
          const refreshData: Quote = await refreshRes.json();
          setQuote(refreshData);
        }
      }
    } catch {
      toast.error("Failed to mark quote as sent");
    } finally {
      setActionState((prev) => ({ ...prev, sending: false }));
    }
  }, [quote, id]);

  const handleShareLink = useCallback(() => {
    if (!quote) return;
    if (quote.shareToken) {
      setShareUrl(`${window.location.origin}/quotes/review/${quote.shareToken}`);
      setShareDialogOpen(true);
    }
  }, [quote]);

  const handleConvertToInvoice = useCallback(async () => {
    if (!quote) return;
    setActionState((prev) => ({ ...prev, converting: true }));
    try {
      const res = await fetch(`/api/quotes/${id}/convert`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Failed to convert quote to invoice");
      } else {
        const data = await res.json();
        toast.success("Quote converted to invoice");
        router.push(data.redirectTo);
      }
    } catch {
      toast.error("Failed to convert quote to invoice");
    } finally {
      setActionState((prev) => ({ ...prev, converting: false }));
    }
  }, [quote, id, router]);

  const handleDecline = useCallback(async () => {
    if (!quote) return;
    setActionState((prev) => ({ ...prev, declining: true }));
    try {
      const res = await fetch(`/api/quotes/${id}/decline`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Failed to decline quote");
      } else {
        toast.success("Quote declined");
        const refreshRes = await fetch(`/api/quotes/${id}`);
        if (refreshRes.ok) {
          const data: Quote = await refreshRes.json();
          setQuote(data);
        }
      }
    } catch {
      toast.error("Failed to decline quote");
    } finally {
      setActionState((prev) => ({ ...prev, declining: false }));
      setDeclineDialogOpen(false);
    }
  }, [quote, id]);

  const handleRevise = useCallback(async () => {
    if (!quote) return;
    setActionState((prev) => ({ ...prev, revising: true }));
    try {
      const res = await fetch(`/api/quotes/${id}/revise`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Failed to create revision");
        return;
      }
      const data = await res.json();
      toast.success("Revision created — redirecting to edit page");
      router.push(data.redirectTo);
    } catch {
      toast.error("Failed to create revision");
    } finally {
      setActionState((prev) => ({ ...prev, revising: false }));
    }
  }, [quote, id, router]);

  const handleMarkSubmitted = useCallback(async (method: "email" | "manual") => {
    setActionState((prev) => ({ ...prev, markingSubmitted: true }));
    try {
      const res = await fetch(`/api/quotes/${id}/mark-submitted`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Failed to update status");
        return;
      }
      toast.success(method === "email" ? "Marked as sent via email" : "Marked as sent manually");
      fetchQuote();
    } catch {
      toast.error("Failed to update status");
    } finally {
      setActionState((prev) => ({ ...prev, markingSubmitted: false }));
    }
  }, [id, fetchQuote]);

  const handleDuplicate = useCallback(async () => {
    setActionState((prev) => ({ ...prev, duplicating: true }));
    try {
      const res = await fetch(`/api/quotes/${id}/duplicate`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Failed to duplicate");
        return;
      }
      const data = await res.json();
      toast.success(`Draft created from ${quote?.quoteNumber ?? "quote"}`);
      router.push(data.redirectTo);
    } catch {
      toast.error("Failed to duplicate");
    } finally {
      setActionState((prev) => ({ ...prev, duplicating: false }));
    }
  }, [id, quote, router]);

  const handleApproveManually = useCallback(async () => {
    if (!quote) return;
    if (approvePaymentMethod === "ACCOUNT_NUMBER" && !approveAccountNumber.trim()) {
      toast.error("Please enter the SAP account number");
      return;
    }
    setActionState((prev) => ({ ...prev, approving: true }));
    try {
      const res = await fetch(`/api/quotes/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentMethod: approvePaymentMethod || undefined,
          accountNumber:
            approvePaymentMethod === "ACCOUNT_NUMBER"
              ? approveAccountNumber.trim()
              : undefined,
          cateringDetails: quote.isCateringEvent
            ? {
                eventDate: approveCateringForm.eventDate.trim(),
                startTime: approveCateringForm.startTime.trim(),
                endTime: approveCateringForm.endTime.trim(),
                contactName: approveCateringForm.contactName.trim(),
                contactPhone: approveCateringForm.contactPhone.trim(),
                location: approveCateringForm.location.trim(),
                setupRequired: approveCateringForm.setupRequired,
                setupTime: approveCateringForm.setupRequired ? approveCateringForm.setupTime.trim() : undefined,
                takedownRequired: approveCateringForm.takedownRequired,
                takedownTime: approveCateringForm.takedownRequired ? approveCateringForm.takedownTime.trim() : undefined,
                specialInstructions: approveCateringForm.specialInstructions.trim() || undefined,
              }
            : undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Failed to approve quote");
      } else {
        toast.success("Quote approved manually");
        fetchQuote();
      }
    } catch {
      toast.error("Failed to approve quote");
    } finally {
      setActionState((prev) => ({ ...prev, approving: false }));
      setApproveDialogOpen(false);
    }
  }, [quote, id, fetchQuote, approvePaymentMethod, approveAccountNumber, approveCateringForm]);

  const handleApproveDialogOpenChange = useCallback((open: boolean) => {
    setApproveDialogOpen(open);
    if (open) {
      setApproveCateringForm(makeManualApprovalCateringForm((quote?.cateringDetails as CateringDetails | null) ?? null));
    } else {
      setApprovePaymentMethod("");
      setApproveAccountNumber("");
      setApproveCateringForm(makeManualApprovalCateringForm(null));
    }
  }, [quote]);

  const handlePaymentDialogOpenChange = useCallback((open: boolean) => {
    setPaymentDialogOpen(open);
    if (!open) {
      setPaymentMethod("");
      setPaymentAccountNumber("");
    }
  }, []);

  const handleResolvePaymentDetails = useCallback(async () => {
    if (!quote) return;
    if (!paymentMethod) {
      toast.error("Please select a payment method");
      return;
    }
    if (paymentMethod === "ACCOUNT_NUMBER" && !paymentAccountNumber.trim()) {
      toast.error("Please enter the SAP account number");
      return;
    }

    setActionState((prev) => ({ ...prev, resolvingPayment: true }));
    try {
      const res = await fetch(`/api/quotes/${id}/payment-details`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentMethod,
          accountNumber: paymentMethod === "ACCOUNT_NUMBER" ? paymentAccountNumber.trim() : null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const fieldErrors = (data?.error?.fieldErrors ?? {}) as Record<string, string[]>;
        const firstFieldError = Object.values(fieldErrors)[0]?.[0];
        toast.error(
          data?.error?.formErrors?.[0] ??
            firstFieldError ??
            data?.error ??
            "Failed to save payment details",
        );
      } else {
        toast.success("Payment details saved");
        await fetchQuote();
        setPaymentDialogOpen(false);
      }
    } catch {
      toast.error("Failed to save payment details");
    } finally {
      setActionState((prev) => ({ ...prev, resolvingPayment: false }));
    }
  }, [quote, paymentMethod, paymentAccountNumber, id, fetchQuote]);
  const handleOpenPdf = useCallback(() => {
    const link = document.createElement("a");
    link.href = pdfUrl;
    link.target = "_blank";
    link.rel = "noreferrer";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }, [pdfUrl]);

  if (loading) {
    return <p className="text-muted-foreground text-sm">Loading...</p>;
  }

  if (!quote) {
    return <p className="text-muted-foreground text-sm">Quote not found.</p>;
  }

  const status = quote.quoteStatus;
  const viewerAccess = quote.viewerAccess ?? {
    canViewQuote: false,
    canManageActions: false,
    canViewActivity: false,
    canViewSensitiveFields: false,
  };
  if (!viewerAccess.canViewQuote) {
    return <p className="text-muted-foreground text-sm">You do not have access to this quote.</p>;
  }
  const canManageActions = viewerAccess.canManageActions;
  const canViewActivity = viewerAccess.canViewActivity;
  const canViewPaymentDetails = viewerAccess.canViewSensitiveFields;
  const showInternalFields = canViewPaymentDetails;
  const currentQuoteCateringDetails = (quote.cateringDetails as CateringDetails | null) ?? null;
  const manualApprovalCateringSource = approveDialogOpen
    ? approveCateringForm
    : makeManualApprovalCateringForm(currentQuoteCateringDetails);
  const missingManualApprovalCateringRequirements = quote.isCateringEvent
    ? getMissingCustomerCateringRequirements(manualApprovalCateringSource)
    : [];
  const manualApprovalBlockedByCatering = missingManualApprovalCateringRequirements.length > 0;
  const hasMissingManualApprovalRequirement = (requirement: string) =>
    missingManualApprovalCateringRequirements.includes(requirement);
  const isConverted = Boolean(quote.convertedToInvoice);
  const canEdit =
    canManageActions &&
    !isConverted &&
    (
      status === "DRAFT" ||
      status === "SENT" ||
      status === "SUBMITTED_EMAIL" ||
      status === "SUBMITTED_MANUAL" ||
      (status === "ACCEPTED" && !quote.convertedToInvoice)
    );

  const cateringGuideSections = currentQuoteCateringDetails
    ? buildCateringGuideSections(quote, currentQuoteCateringDetails, showInternalFields)
    : [];

  function handlePrintCateringGuide(printMarkup: string) {
    // `noopener`/`noreferrer` can cause some browsers to return a null handle,
    // which prevents us from writing the generated guide into the new tab.
    const printWindow = window.open("about:blank", "_blank");
    if (!printWindow) {
      toast.error("Unable to open the catering guide print preview");
      return;
    }

    printWindow.document.open();
    printWindow.document.write(printMarkup);
    printWindow.document.close();
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-balance">
            {quote.quoteNumber ?? "Untitled Quote"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Created {formatDate(quote.createdAt)} by {quote.creatorName}
          </p>
          {quote.expirationDate && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {expirationText(quote.expirationDate)}
            </p>
          )}
          {quote.revisedFromQuote && (
            <Link href={`/quotes/${quote.revisedFromQuote.id}`} className="text-xs text-muted-foreground hover:text-foreground">
              Revised from {quote.revisedFromQuote.quoteNumber}
            </Link>
          )}
          {quote.revisedToQuote && (
            <Link href={`/quotes/${quote.revisedToQuote.id}`} className="text-xs text-blue-600 hover:underline">
              → Revised as {quote.revisedToQuote.quoteNumber}
            </Link>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:justify-end" data-print-hide>
          <Badge variant={statusBadgeVariant[status]}>
            {statusLabel[status]}
          </Badge>
          <FollowUpBadge state={quote.paymentFollowUpBadge ?? null} />

          <Button variant="outline" size="sm" onClick={handleOpenPdf}>
            <PrinterIcon className="size-3.5 mr-1.5" />
            Download / Regenerate PDF
          </Button>

          {/* ── Primary actions ─────────────────────────────────────── */}

          {canManageActions && (
            <>
              {/* DRAFT: Send Quote + Edit */}
              {status === "DRAFT" && (
                <>
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 text-white"
                    onClick={handleMarkAsSent}
                    disabled={actionState.sending}
                  >
                    {actionState.sending ? "Sending..." : "Send Quote"}
                  </Button>
                  <Link
                    href={`/quotes/${id}/edit`}
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    Edit
                  </Link>
                </>
              )}

              {status === "ACCEPTED" && (
                <>
                  {!isConverted && (
                    <Link
                      href={`/quotes/${id}/edit`}
                      className={buttonVariants({ variant: "outline", size: "sm" })}
                    >
                      Edit
                    </Link>
                  )}
                  {quote.paymentDetailsResolved ? (
                    !isConverted && (
                      <Button
                        size="sm"
                        onClick={handleConvertToInvoice}
                        disabled={actionState.converting}
                      >
                        {actionState.converting ? "Converting..." : "Convert to Invoice"}
                      </Button>
                    )
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPaymentDialogOpen(true)}
                      disabled={actionState.resolvingPayment}
                    >
                      {actionState.resolvingPayment ? "Saving..." : "Resolve Payment Details"}
                    </Button>
                  )}
                </>
              )}

              {/* SENT / SUBMITTED: approve first; conversion is gated on accepted + payment resolved */}
              {!isConverted && (status === "SENT" || status === "SUBMITTED_EMAIL" || status === "SUBMITTED_MANUAL") && (
                <>
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => setApproveDialogOpen(true)}
                    disabled={actionState.approving}
                  >
                    {actionState.approving ? "Approving..." : "Approve Manually"}
                  </Button>
                </>
              )}
            </>
          )}

          {/* ACCEPTED: link to converted invoice */}
          {quote.convertedToInvoice && (
            <Link
              href={`/invoices/${quote.convertedToInvoice.id}`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              View Invoice {quote.convertedToInvoice.invoiceNumber ?? ""}
            </Link>
          )}

          {/* DECLINED / EXPIRED: Revise & Resubmit */}
          {canManageActions && (status === "DECLINED" || status === "EXPIRED") && (
            <Button
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white"
              onClick={handleRevise}
              disabled={actionState.revising}
            >
              {actionState.revising ? "Creating revision..." : "Revise & Resubmit"}
            </Button>
          )}

          {/* ── Secondary actions ──────────────────────────────────── */}

          {/* Share Link: visible for SENT/SUBMITTED statuses */}
          {canManageActions && !isConverted && (status === "SENT" || status === "SUBMITTED_EMAIL" || status === "SUBMITTED_MANUAL") && quote.shareToken && (
            <Button variant="outline" size="sm" onClick={handleShareLink}>
              <LinkIcon className="size-3.5 mr-1.5" />
              Share Link
            </Button>
          )}

          {/* ── More dropdown ──────────────────────────────────────── */}

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="outline" size="sm">
                  <MoreHorizontalIcon className="size-4 mr-1.5" />
                  More
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              {/* Edit (when not shown as primary) */}
              {canManageActions && canEdit && status !== "DRAFT" && !(status === "ACCEPTED" && !quote.convertedToInvoice) && (
                <DropdownMenuItem onClick={() => router.push(`/quotes/${id}/edit`)}>
                  Edit
                </DropdownMenuItem>
              )}

              {/* Duplicate: all statuses */}
              {canManageActions && (
                <DropdownMenuItem onClick={handleDuplicate} disabled={actionState.duplicating}>
                  {actionState.duplicating ? "Duplicating..." : "Duplicate"}
                </DropdownMenuItem>
              )}

              {/* Share Link: in dropdown for ACCEPTED, DECLINED, REVISED, EXPIRED */}
              {canManageActions && status !== "DRAFT" && status !== "SENT" && status !== "SUBMITTED_EMAIL" && status !== "SUBMITTED_MANUAL" && quote.shareToken && (
                <DropdownMenuItem onClick={handleShareLink}>
                  Share Link
                </DropdownMenuItem>
              )}

              {/* Mark as Delivered: SENT only */}
              {canManageActions && status === "SENT" && (
                <DropdownMenuItem onClick={() => handleMarkSubmitted("manual")} disabled={actionState.markingSubmitted}>
                  {actionState.markingSubmitted ? "Updating..." : "Mark as Delivered"}
                </DropdownMenuItem>
              )}

              {/* Destructive actions separator */}
              {canManageActions && (status === "SENT" || status === "SUBMITTED_EMAIL" || status === "SUBMITTED_MANUAL" ||
                status === "DRAFT" || status === "DECLINED" || status === "EXPIRED") && (
                <DropdownMenuSeparator />
              )}

              {/* Decline: SENT, SUBMITTED_EMAIL, SUBMITTED_MANUAL */}
              {canManageActions && (status === "SENT" || status === "SUBMITTED_EMAIL" || status === "SUBMITTED_MANUAL") && (
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => setDeclineDialogOpen(true)}
                >
                  Decline
                </DropdownMenuItem>
              )}

              {/* Delete: DRAFT, SENT, DECLINED, EXPIRED */}
              {canManageActions && (status === "DRAFT" || status === "SENT" || status === "DECLINED" || status === "EXPIRED") && (
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => setDeleteDialogOpen(true)}
                >
                  Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* ── Confirmation dialogs (rendered outside dropdown tree) ── */}

        {/* Approve manually dialog */}
        <Dialog open={approveDialogOpen} onOpenChange={handleApproveDialogOpenChange}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Approve Quote Manually</DialogTitle>
              <DialogDescription>
                This will mark the quote as approved without client confirmation.
                Use this when the client has approved verbally or by other means
                outside the system.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              {manualApprovalBlockedByCatering && (
                <div className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
                  <p className="font-medium">
                    This catering quote is missing event details required for manual approval.
                  </p>
                  <p>
                    Fill in: {missingManualApprovalCateringRequirements.join(", ")}.
                  </p>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {hasMissingManualApprovalRequirement("event date") && (
                      <div className="space-y-1.5">
                        <Label htmlFor="manual-approve-event-date">Event Date</Label>
                        <Input
                          id="manual-approve-event-date"
                          type="date"
                          value={approveCateringForm.eventDate}
                          onChange={(e) =>
                            setApproveCateringForm((prev) => ({ ...prev, eventDate: e.target.value }))
                          }
                        />
                      </div>
                    )}
                    {hasMissingManualApprovalRequirement("start time") && (
                      <div className="space-y-1.5">
                        <Label htmlFor="manual-approve-start-time">Start Time</Label>
                        <TimeSelect
                          id="manual-approve-start-time"
                          value={approveCateringForm.startTime}
                          onValueChange={(value) =>
                            setApproveCateringForm((prev) => ({ ...prev, startTime: value }))
                          }
                          placeholder="Select start time"
                        />
                      </div>
                    )}
                    {hasMissingManualApprovalRequirement("end time") && (
                      <div className="space-y-1.5">
                        <Label htmlFor="manual-approve-end-time">End Time</Label>
                        <TimeSelect
                          id="manual-approve-end-time"
                          value={approveCateringForm.endTime}
                          onValueChange={(value) =>
                            setApproveCateringForm((prev) => ({ ...prev, endTime: value }))
                          }
                          placeholder="Select end time"
                        />
                      </div>
                    )}
                    {hasMissingManualApprovalRequirement("contact name") && (
                      <div className="space-y-1.5">
                        <Label htmlFor="manual-approve-contact-name">Contact Name</Label>
                        <Input
                          id="manual-approve-contact-name"
                          value={approveCateringForm.contactName}
                          onChange={(e) =>
                            setApproveCateringForm((prev) => ({ ...prev, contactName: e.target.value }))
                          }
                        />
                      </div>
                    )}
                    {hasMissingManualApprovalRequirement("contact number") && (
                      <div className="space-y-1.5">
                        <Label htmlFor="manual-approve-contact-number">Contact Number</Label>
                        <Input
                          id="manual-approve-contact-number"
                          value={approveCateringForm.contactPhone}
                          onChange={(e) =>
                            setApproveCateringForm((prev) => ({ ...prev, contactPhone: e.target.value }))
                          }
                        />
                      </div>
                    )}
                    {hasMissingManualApprovalRequirement("event location") && (
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label htmlFor="manual-approve-location">Event Location</Label>
                        <Input
                          id="manual-approve-location"
                          placeholder="Building, Room, Area"
                          value={approveCateringForm.location}
                          onChange={(e) =>
                            setApproveCateringForm((prev) => ({ ...prev, location: e.target.value }))
                          }
                        />
                      </div>
                    )}
                    {hasMissingManualApprovalRequirement("setup time") && (
                      <div className="space-y-1.5">
                        <Label htmlFor="manual-approve-setup-time">Setup Time</Label>
                        <TimeSelect
                          id="manual-approve-setup-time"
                          value={approveCateringForm.setupTime}
                          onValueChange={(value) =>
                            setApproveCateringForm((prev) => ({ ...prev, setupTime: value }))
                          }
                          placeholder="Select setup time"
                        />
                      </div>
                    )}
                    {hasMissingManualApprovalRequirement("takedown time") && (
                      <div className="space-y-1.5">
                        <Label htmlFor="manual-approve-takedown-time">Takedown Time</Label>
                        <TimeSelect
                          id="manual-approve-takedown-time"
                          value={approveCateringForm.takedownTime}
                          onValueChange={(value) =>
                            setApproveCateringForm((prev) => ({ ...prev, takedownTime: value }))
                          }
                          placeholder="Select takedown time"
                        />
                      </div>
                    )}
                  </div>

                  <p className="text-xs text-amber-800">
                    Times are shown in Los Angeles time and standard AM/PM format.
                  </p>
                </div>
              )}
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Payment Method
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  {MANUAL_APPROVAL_PAYMENT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        setApprovePaymentMethod(opt.value);
                        if (opt.value !== "ACCOUNT_NUMBER") setApproveAccountNumber("");
                      }}
                      className={`rounded-md border px-3 py-2 text-sm transition-colors ${
                        approvePaymentMethod === opt.value
                          ? "border-primary bg-primary/10 font-medium text-primary"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {approvePaymentMethod === "ACCOUNT_NUMBER" && (
                <div className="space-y-1.5">
                  <Label htmlFor="manual-approve-account-number">SAP Account Number</Label>
                  <Input
                    id="manual-approve-account-number"
                    value={approveAccountNumber}
                    onChange={(e) => setApproveAccountNumber(e.target.value)}
                    placeholder="Enter SAP account number"
                  />
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                Optional. Capture payment details here if you want to convert this quote right away after approval.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setApproveDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={handleApproveManually}
                disabled={actionState.approving || manualApprovalBlockedByCatering}
              >
                {actionState.approving ? "Approving..." : "Approve Quote"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={paymentDialogOpen} onOpenChange={handlePaymentDialogOpenChange}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Resolve Payment Details</DialogTitle>
              <DialogDescription>
                {isConverted
                  ? "Save the payment method for this accepted quote. The linked invoice will be updated too."
                  : "Save the payment method for this accepted quote so it can be converted to an invoice."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Payment Method
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  {MANUAL_APPROVAL_PAYMENT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        setPaymentMethod(opt.value);
                        if (opt.value !== "ACCOUNT_NUMBER") setPaymentAccountNumber("");
                      }}
                      className={`rounded-md border px-3 py-2 text-sm transition-colors ${
                        paymentMethod === opt.value
                          ? "border-primary bg-primary/10 font-medium text-primary"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {paymentMethod === "ACCOUNT_NUMBER" && (
                <div className="space-y-1.5">
                  <Label htmlFor="resolve-payment-account-number">SAP Account Number</Label>
                  <Input
                    id="resolve-payment-account-number"
                    value={paymentAccountNumber}
                    onChange={(e) => setPaymentAccountNumber(e.target.value)}
                    placeholder="Enter SAP account number"
                  />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleResolvePaymentDetails} disabled={actionState.resolvingPayment}>
                {actionState.resolvingPayment ? "Saving..." : "Save Payment Details"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Decline dialog */}
        <Dialog open={declineDialogOpen} onOpenChange={setDeclineDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Decline Quote</DialogTitle>
              <DialogDescription>
                Are you sure you want to decline this quote? This will mark it
                as declined.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeclineDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDecline}
                disabled={actionState.declining}
              >
                {actionState.declining ? "Declining..." : "Decline Quote"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Quote</DialogTitle>
              <DialogDescription>
                This will permanently delete the quote. This action cannot be
                undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={actionState.deleting}
              >
                {actionState.deleting ? "Deleting..." : "Delete Quote"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Two-column grid: Quote Information + Staff Member / Recipient */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Quote Information */}
        <Card>
          <CardHeader>
            <CardTitle>Quote Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Date</span>
              <span>{formatDate(quote.date)}</span>
            </div>
            {quote.expirationDate && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Expiration Date</span>
                <span>{formatDate(quote.expirationDate)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Department</span>
              <Badge variant="secondary">{quote.department}</Badge>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Category</span>
              <Badge variant="outline">
                {quote.category
                  ? quote.category.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())
                  : "\u2014"}
              </Badge>
            </div>
            {showInternalFields && (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Account Number</span>
                  <span className="flex items-center gap-2">
                    {quote.accountNumber || "\u2014"}
                    <FollowUpBadge state={followUpBadge} />
                  </span>
                </div>
                {canManageActions && !quote.accountNumber && quote.staff?.email && (
                  !followUpBadge || followUpBadge.seriesStatus === "EXHAUSTED"
                ) && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => setRequestDialogOpen(true)}
                  >
                    Request Account Number
                  </Button>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Account Code</span>
                  <span>{quote.accountCode || "\u2014"}</span>
                </div>
              </>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total Amount</span>
              <span className="font-bold">{formatAmount(quote.totalAmount)}</span>
            </div>

            {showInternalFields && (quote.marginEnabled || quote.taxEnabled) && (
              <div className="flex flex-wrap gap-2 pt-1">
                {quote.marginEnabled && quote.marginPercent != null && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 text-xs font-medium text-blue-600 dark:text-blue-400">
                    Margin: {Number(quote.marginPercent)}%
                  </span>
                )}
                {quote.taxEnabled && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                    Tax: {(Number(quote.taxRate) * 100).toFixed(2)}%
                  </span>
                )}
              </div>
            )}

            {quote.notes && (
              <>
                <Separator />
                <div className="text-sm">
                  <p className="text-muted-foreground mb-1">Notes</p>
                  <p className="whitespace-pre-wrap">{quote.notes}</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          {/* Staff Member */}
          {quote.staff ? (
            <Card>
              <CardHeader>
                <CardTitle>Staff Member</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Name</span>
                  <span className="font-bold">{quote.staff.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Title</span>
                  <span>{quote.staff.title}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Department</span>
                  <span>{quote.staff.department}</span>
                </div>
                {quote.staff.extension && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Extension</span>
                    <span>{quote.staff.extension}</span>
                  </div>
                )}
                {quote.staff.email && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Email</span>
                    <span>{quote.staff.email}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : quote.contact ? (
            <Card>
              <CardHeader>
                <CardTitle>Contact</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Name</span>
                  <span className="font-bold">{quote.contact.name}</span>
                </div>
                {quote.contact.title && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Title</span>
                    <span>{quote.contact.title}</span>
                  </div>
                )}
                {quote.contact.org && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Organization</span>
                    <span>{quote.contact.org}</span>
                  </div>
                )}
                {quote.contact.email && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Email</span>
                    <span>{quote.contact.email}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : null}

          {/* Recipient */}
          {(quote.recipientName || quote.recipientEmail || quote.recipientOrg) && (
            <Card>
              <CardHeader>
                <CardTitle>Recipient</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {quote.recipientName && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Name</span>
                    <span className="font-bold">{quote.recipientName}</span>
                  </div>
                )}
                {quote.recipientEmail && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Email</span>
                    <span>{quote.recipientEmail}</span>
                  </div>
                )}
                {quote.recipientOrg && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Organization</span>
                    <span>{quote.recipientOrg}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Payment status banner */}
      {canViewPaymentDetails && quote.quoteStatus === "ACCEPTED" && !quote.paymentDetailsResolved && (
        <Card className="border-amber-500/30 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="py-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-amber-600 text-sm font-medium">
                Payment details incomplete
              </span>
              <FollowUpBadge state={quote.paymentFollowUpBadge ?? null} />
            </div>
            <p className="mt-2 text-sm text-amber-900/80 dark:text-amber-200/80">
              {quote.paymentFollowUpBadge?.seriesStatus === "EXHAUSTED"
                ? "Automatic payment follow-up ended without a payment response for this accepted quote."
                : "Automatic payment follow-up is active for this accepted quote until payment details are collected."}
            </p>
            <p className="mt-1 text-xs text-amber-800/80 dark:text-amber-300/80">
              The customer can still use the public payment link, and staff can resolve payment details here at any time.
            </p>
          </CardContent>
        </Card>
      )}

      {canViewPaymentDetails && quote.quoteStatus === "ACCEPTED" && quote.paymentDetailsResolved && (
        <Card className="border-green-500/30 bg-green-50 dark:bg-green-950/20">
          <CardContent className="py-4">
            <div className="flex items-center gap-2 text-sm">
              {quote.paymentMethod ? (
                <>
                  <span className="text-green-600 font-medium">Payment method:</span>
                  <span>{quote.paymentMethod.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}</span>
                  {quote.paymentAccountNumber && (
                    <span className="text-muted-foreground">• Account: {quote.paymentAccountNumber}</span>
                  )}
                </>
              ) : (
                <span className="text-green-600 font-medium">
                  Payment details are already on file for this quote.
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Line Items */}
      {(() => {
        const showInternalPricing = showInternalFields && quote.marginEnabled;
        const colCount = showInternalPricing ? 6 : 4;

        // Cost subtotal (before margin)
        const costSubtotal = quote.items.reduce((sum, item) => {
          const cost = item.costPrice != null ? Number(item.costPrice) : Number(item.unitPrice);
          return sum + cost * Number(item.quantity);
        }, 0);

        // Margin amount — mirror the backend percentage-based calculation
        // with per-item marginOverride support
        const globalMargin = Number(quote.marginPercent ?? 0);
        const marginAmt = quote.marginEnabled
          ? quote.items.reduce((sum, item) => {
              const cost = item.costPrice != null ? Number(item.costPrice) : Number(item.unitPrice);
              const qty = Number(item.quantity);
              const effectiveMargin = item.marginOverride != null
                ? Number(item.marginOverride)
                : globalMargin;
              return sum + cost * qty * (effectiveMargin / 100);
            }, 0)
          : 0;

        // Tax
        const taxableTotal = quote.items
          .filter((item) => item.isTaxable !== false)
          .reduce((sum, item) => sum + Number(item.extendedPrice), 0);
        const taxRate = Number(quote.taxRate ?? 0.0975);
        const taxAmt = quote.taxEnabled
          ? Math.round(taxableTotal * taxRate * 100) / 100
          : 0;

        return (
          <Card>
            <CardHeader className="flex flex-row items-center gap-3">
              <CardTitle>Line Items</CardTitle>
              {showInternalPricing && (
                <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                  Internal Only
                </span>
              )}
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-center">Qty</TableHead>
                    {showInternalPricing ? (
                      <>
                        <TableHead className="text-right">Cost</TableHead>
                        <TableHead className="text-right">Margin</TableHead>
                        <TableHead className="text-right">Charged</TableHead>
                      </>
                    ) : (
                      <TableHead className="text-right">Unit Price</TableHead>
                    )}
                    <TableHead className="text-right">Extended</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quote.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="uppercase">{item.description}</TableCell>
                      <TableCell className="text-center tabular-nums">
                        {Number(item.quantity)}
                      </TableCell>
                      {showInternalPricing ? (
                        (() => {
                          const cost = item.costPrice != null ? Number(item.costPrice) : Number(item.unitPrice);
                          const effectiveMargin = item.marginOverride != null
                            ? Number(item.marginOverride)
                            : globalMargin;
                          const marginDollars = cost * Number(item.quantity) * (effectiveMargin / 100);
                          return (
                            <>
                              <TableCell className="text-right tabular-nums">
                                {formatAmount(cost)}
                              </TableCell>
                              <TableCell className="text-right tabular-nums text-amber-700">
                                {effectiveMargin}% ({formatAmount(marginDollars)})
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {formatAmount(item.unitPrice)}
                              </TableCell>
                            </>
                          );
                        })()
                      ) : (
                        <TableCell className="text-right tabular-nums">
                          {formatAmount(item.unitPrice)}
                        </TableCell>
                      )}
                      <TableCell className="text-right tabular-nums">
                        {formatAmount(item.extendedPrice)}
                      </TableCell>
                    </TableRow>
                  ))}

                  {/* Breakdown rows */}
                  {showInternalPricing && (
                    <TableRow>
                      <TableCell
                        colSpan={colCount - 1}
                        className="text-right text-sm text-muted-foreground"
                      >
                        Subtotal (Cost)
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground tabular-nums">
                        {formatAmount(costSubtotal)}
                      </TableCell>
                    </TableRow>
                  )}
                  {showInternalPricing && (
                    <TableRow>
                      <TableCell
                        colSpan={colCount - 1}
                        className="text-right text-sm text-muted-foreground"
                      >
                        Margin ({Number(quote.marginPercent ?? 0)}%)
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground tabular-nums">
                        +{formatAmount(marginAmt)}
                      </TableCell>
                    </TableRow>
                  )}
                  {quote.taxEnabled && (
                    <TableRow>
                      <TableCell
                        colSpan={colCount - 1}
                        className="text-right text-sm text-muted-foreground"
                      >
                        Tax ({(taxRate * 100).toFixed(2)}%)
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground tabular-nums">
                        +{formatAmount(taxAmt)}
                      </TableCell>
                    </TableRow>
                  )}

                  {/* Total row */}
                  <TableRow>
                    <TableCell colSpan={colCount - 1} className="text-right font-bold">
                      Total
                    </TableCell>
                    <TableCell className="text-right font-bold tabular-nums">
                      {formatAmount(quote.totalAmount)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );
      })()}

      {/* Catering Guide */}
      {quote.isCateringEvent && (() => {
        const catering = quote.cateringDetails as CateringDetails | null;
        if (!catering) return null;

        // Calculate subtotal / tax for the printable guide
        const itemSubtotal = quote.items.reduce(
          (sum, item) => sum + Number(item.extendedPrice),
          0
        );
        const taxRate = quote.taxRate ?? 0;
        const taxableSubtotal = quote.taxEnabled
          ? quote.items.filter((item) => item.isTaxable).reduce((sum, item) => sum + Number(item.extendedPrice), 0)
          : 0;
        const taxAmount = quote.taxEnabled ? Math.round(taxableSubtotal * taxRate * 100) / 100 : 0;
        const grandTotal = itemSubtotal + taxAmount;
        const cateringGuidePrintDocument = buildCateringGuidePrintDocument({
          quote,
          sections: cateringGuideSections,
          itemSubtotal,
          taxAmount,
          grandTotal,
        });

        return (
          <div className="catering-guide">
            <Card className="border-orange-500/20 bg-orange-500/5 print:border-border print:bg-white">
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="text-orange-600 dark:text-orange-400">
                  🍽 Catering Guide
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  data-print-hide
                  onClick={() => handlePrintCateringGuide(cateringGuidePrintDocument)}
                >
                  <PrinterIcon className="size-3.5 mr-1.5" />
                  Print Catering Guide
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1">
                  <p className="text-lg font-semibold">
                    {(() => {
                      const dateTime = formatCateringDateTime(catering);
                      if (catering.eventName && dateTime) return `${catering.eventName} — ${dateTime}`;
                      if (catering.eventName) return catering.eventName;
                      if (dateTime) return dateTime;
                      return "Catering Event";
                    })()}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    This guide is generated from the current quote record and updates as staff or the customer add information.
                  </p>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  {cateringGuideSections.map((section) => (
                    <section
                      key={section.title}
                      className="catering-guide-section rounded-lg border border-border/70 bg-background/90 p-4"
                    >
                      <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        {section.title}
                      </h3>
                      <dl className="mt-3 space-y-3 text-sm">
                        {section.fields.map((field) => (
                          <div
                            key={`${section.title}-${field.label}`}
                            className="grid gap-1 sm:grid-cols-[140px_minmax(0,1fr)] sm:gap-3"
                          >
                            <dt className="font-medium text-muted-foreground">{field.label}</dt>
                            <dd className="whitespace-pre-wrap break-words font-medium text-foreground">{field.value}</dd>
                          </div>
                        ))}
                      </dl>
                    </section>
                  ))}
                </div>

                <section className="catering-guide-section rounded-lg border border-border/70 bg-background/90 p-4">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Ordered Items
                  </h3>
                  <ul className="mt-3 space-y-3 text-sm">
                    {quote.items.map((item) => (
                      <li key={item.id} className="border-b border-border/70 pb-3 last:border-b-0 last:pb-0">
                        <p className="font-semibold">{item.description || "Line Item"}</p>
                        <p className="mt-1 break-words text-muted-foreground">
                          Qty {Number(item.quantity)} · Unit {formatAmount(item.unitPrice)} · Line {formatAmount(item.extendedPrice)} · {item.isTaxable ? "Taxable" : "Non-taxable"}
                        </p>
                      </li>
                    ))}
                  </ul>
                </section>

                <section className="catering-guide-section rounded-lg border border-border/70 bg-background/90 p-4">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Pricing Summary
                  </h3>
                  <dl className="mt-3 space-y-3 text-sm tabular-nums">
                    <div className="flex items-start justify-between gap-3">
                      <dt className="font-medium text-muted-foreground">Subtotal</dt>
                      <dd className="font-semibold">{formatAmount(itemSubtotal)}</dd>
                    </div>
                    {quote.taxEnabled && (
                      <div className="flex items-start justify-between gap-3">
                        <dt className="font-medium text-muted-foreground">Tax ({(taxRate * 100).toFixed(2)}%)</dt>
                        <dd className="font-semibold">{formatAmount(taxAmount)}</dd>
                      </div>
                    )}
                    <div className="flex items-start justify-between gap-3 border-t border-border pt-3 text-base">
                      <dt className="font-semibold">Total</dt>
                      <dd className="font-bold">{formatAmount(grandTotal)}</dd>
                    </div>
                  </dl>
                </section>
              </CardContent>
            </Card>
          </div>
        );
      })()}

      {/* Activity tracking */}
      {canViewActivity && (status === "SENT" || status === "SUBMITTED_EMAIL" || status === "SUBMITTED_MANUAL" || status === "ACCEPTED" || status === "DECLINED") && (
        <QuoteActivity quoteId={id} />
      )}

      {/* Share Link Dialog */}
      {shareUrl && (
        <ShareLinkDialog
          open={shareDialogOpen}
          onOpenChange={setShareDialogOpen}
          shareUrl={shareUrl}
          quoteNumber={quote.quoteNumber}
          recipientEmail={quote.recipientEmail}
          recipientName={quote.recipientName}
          quoteId={id}
          quoteStatus={quote.quoteStatus}
        />
      )}

      {/* Request Account Number Dialog */}
      {quote.staff?.email && (
        <RequestAccountDialog
          open={requestDialogOpen}
          onOpenChange={setRequestDialogOpen}
          invoiceId={id}
          recipientName={quote.staff.name}
          recipientEmail={quote.staff.email}
          onSuccess={() => {
            refreshBadge();
            fetchQuote();
          }}
        />
      )}
    </div>
  );
}
