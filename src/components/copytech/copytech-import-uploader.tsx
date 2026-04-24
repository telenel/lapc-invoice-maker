"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  FileSpreadsheetIcon,
  Loader2Icon,
  UploadIcon,
} from "lucide-react";
import { toast } from "sonner";
import { copyTechImportApi } from "@/domains/copytech-import/api-client";
import type {
  CopyTechImportCsvFormat,
  CopyTechImportPreview,
} from "@/domains/copytech-import/types";
import { ApiError } from "@/domains/shared/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface CopyTechImportUploaderProps {
  format: CopyTechImportCsvFormat;
}

function formatCurrency(value: number): string {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Request failed";
}

export function CopyTechImportUploader({ format }: CopyTechImportUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<CopyTechImportPreview | null>(null);
  const [busy, setBusy] = useState<"preview" | "commit" | null>(null);
  const [createdInvoiceIds, setCreatedInvoiceIds] = useState<string[]>([]);
  const [requestError, setRequestError] = useState<string | null>(null);

  const canCommit = preview != null && preview.errors.length === 0 && preview.invoiceCount > 0 && file != null;
  const headerLine = useMemo(
    () => [...format.requiredHeaders, ...format.optionalHeaders].join(","),
    [format.optionalHeaders, format.requiredHeaders],
  );

  function handleFileChange(nextFile: File | null) {
    setFile(nextFile);
    setPreview(null);
    setCreatedInvoiceIds([]);
    setRequestError(null);
  }

  async function handlePreview() {
    if (!file) {
      inputRef.current?.click();
      return;
    }

    setBusy("preview");
    setRequestError(null);
    setCreatedInvoiceIds([]);

    try {
      const nextPreview = await copyTechImportApi.preview(file);
      setPreview(nextPreview);
      if (nextPreview.errors.length > 0) {
        toast.error("CSV needs fixes before draft invoices can be created.");
      } else {
        toast.success("CSV preview is ready.");
      }
    } catch (error) {
      const message = getErrorMessage(error);
      setRequestError(message);
      toast.error(message);
    } finally {
      setBusy(null);
    }
  }

  async function handleCommit() {
    if (!file || !canCommit) return;

    setBusy("commit");
    setRequestError(null);

    try {
      const result = await copyTechImportApi.commit(file);
      setPreview(result.preview);
      setCreatedInvoiceIds(result.createdInvoices.map((invoice) => invoice.id));
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      toast.success(`${result.createdInvoices.length} draft invoice${result.createdInvoices.length === 1 ? "" : "s"} created.`);
    } catch (error) {
      const message = getErrorMessage(error);
      setRequestError(message);
      toast.error(message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,420px)_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Upload</CardTitle>
            <CardDescription>CSV rows become CopyTech draft invoice line items.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className={cn(
                "flex min-h-[150px] w-full flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-muted/20 px-4 py-6 text-center transition-colors hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                file && "border-primary/50 bg-primary/5",
              )}
            >
              <FileSpreadsheetIcon className="size-7 text-muted-foreground" aria-hidden="true" />
              <span className="max-w-full truncate text-sm font-medium">
                {file ? file.name : "Choose CSV file"}
              </span>
              {file ? (
                <span className="text-xs text-muted-foreground">
                  {(file.size / 1024).toFixed(1)} KB
                </span>
              ) : null}
            </button>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={(event) => handleFileChange(event.target.files?.[0] ?? null)}
            />
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                className="gap-2"
                onClick={handlePreview}
                disabled={busy !== null}
              >
                {busy === "preview" ? <Loader2Icon className="size-4 animate-spin" aria-hidden="true" /> : <UploadIcon className="size-4" aria-hidden="true" />}
                Preview
              </Button>
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                onClick={handleCommit}
                disabled={!canCommit || busy !== null || createdInvoiceIds.length > 0}
              >
                {busy === "commit" ? <Loader2Icon className="size-4 animate-spin" aria-hidden="true" /> : <CheckCircle2Icon className="size-4" aria-hidden="true" />}
                Create drafts
              </Button>
            </div>
            {requestError ? (
              <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {requestError}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Format</CardTitle>
            <CardDescription>Required columns first; optional columns may follow in any order.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <p className="text-xs font-medium uppercase text-muted-foreground">Required</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {format.requiredHeaders.map((header) => (
                    <Badge key={header} variant="secondary">{header}</Badge>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-muted-foreground">Optional</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {format.optionalHeaders.map((header) => (
                    <Badge key={header} variant="outline">{header}</Badge>
                  ))}
                </div>
              </div>
            </div>
            <div className="rounded-lg border bg-muted/20 p-3">
              <code className="block overflow-x-auto whitespace-nowrap text-xs">{headerLine}</code>
            </div>
          </CardContent>
        </Card>
      </div>

      {preview ? (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <Metric label="Rows" value={preview.rowCount.toLocaleString("en-US")} />
            <Metric label="Skipped" value={preview.skippedRowCount.toLocaleString("en-US")} />
            <Metric label="Errors" value={preview.erroredRowCount.toLocaleString("en-US")} />
            <Metric label="Drafts" value={preview.invoiceCount.toLocaleString("en-US")} />
            <Metric label="Lines" value={preview.validRowCount.toLocaleString("en-US")} />
            <Metric label="Total" value={formatCurrency(preview.totalAmount)} />
          </div>

          {createdInvoiceIds.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Created Drafts</CardTitle>
                <CardDescription>{createdInvoiceIds.length} draft invoice{createdInvoiceIds.length === 1 ? "" : "s"} created.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {createdInvoiceIds.map((id) => (
                  <Button key={id} variant="outline" size="sm" render={<Link href={`/invoices/${id}`} />}>
                    Open invoice
                  </Button>
                ))}
              </CardContent>
            </Card>
          ) : null}

          {preview.errors.length > 0 || preview.warnings.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Validation</CardTitle>
                <CardDescription>Rows with errors are blocked; warnings are informational.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {preview.errors.map((error, index) => (
                    <ValidationRow key={`error-${index}`} tone="error" rowNumber={error.rowNumber} field={error.field} message={error.message} />
                  ))}
                  {preview.warnings.map((warning, index) => (
                    <ValidationRow key={`warning-${index}`} tone="warning" rowNumber={warning.rowNumber} field={warning.field} message={warning.message} />
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : null}

          {preview.invoices.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Draft Preview</CardTitle>
                <CardDescription>Grouped by date, department, account number, account code, and requester.</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Account</TableHead>
                      <TableHead>Requester</TableHead>
                      <TableHead className="text-right">Lines</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.invoices.map((invoice) => (
                      <TableRow key={invoice.groupKey}>
                        <TableCell>{invoice.invoiceDate}</TableCell>
                        <TableCell>{invoice.department}</TableCell>
                        <TableCell>{invoice.accountNumber}</TableCell>
                        <TableCell>{invoice.requesterName || "Unassigned"}</TableCell>
                        <TableCell className="text-right">{invoice.lineItems.length}</TableCell>
                        <TableCell className="text-right">{formatCurrency(invoice.totalAmount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card px-4 py-3">
      <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function ValidationRow({
  tone,
  rowNumber,
  field,
  message,
}: {
  tone: "error" | "warning";
  rowNumber: number;
  field: string;
  message: string;
}) {
  return (
    <div
      className={cn(
        "flex gap-3 rounded-lg border px-3 py-2 text-sm",
        tone === "error"
          ? "border-destructive/30 bg-destructive/10 text-destructive"
          : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
      )}
    >
      <AlertCircleIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div>
        <p className="font-medium">Row {rowNumber} · {field}</p>
        <p>{message}</p>
      </div>
    </div>
  );
}
