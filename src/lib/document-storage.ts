import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const DOCUMENTS_BUCKET = "laportal-documents";

function assertSafeObjectKey(objectKey: string): string {
  const normalized = objectKey.trim().replace(/^\/+/, "");
  if (!normalized || normalized.includes("..") || normalized.includes("\\")) {
    throw new Error("Invalid storage object key");
  }
  return normalized;
}

function sanitizeFilenameBase(value: string): string {
  const sanitized = value
    .trim()
    .replace(/[\r\n"]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return sanitized || "document";
}

export function uploadPdfObjectKey(filename: string): string {
  return `uploads/${sanitizeFilenameBase(filename)}`;
}

export function invoicePdfObjectKey(invoiceId: string, invoiceNumber: string): string {
  return `invoices/${invoiceId}/${sanitizeFilenameBase(invoiceNumber)}.pdf`;
}

export function quotePdfObjectKey(quoteId: string, quoteNumber: string): string {
  return `quotes/${quoteId}/${sanitizeFilenameBase(quoteNumber)}.pdf`;
}

export function printQuotePdfObjectKey(quoteId: string, quoteNumber: string): string {
  return `print-quotes/${quoteId}/${sanitizeFilenameBase(quoteNumber)}.pdf`;
}

export async function uploadDocument(
  objectKey: string,
  data: Buffer,
  contentType = "application/pdf"
): Promise<string> {
  const supabase = getSupabaseAdminClient();
  const key = assertSafeObjectKey(objectKey);

  const { error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .upload(key, data, {
      contentType,
      upsert: true,
    });

  if (error) {
    throw new Error(`Supabase upload failed for ${key}: ${error.message}`);
  }

  return key;
}

export async function downloadDocument(objectKey: string): Promise<Buffer> {
  const supabase = getSupabaseAdminClient();
  const key = assertSafeObjectKey(objectKey);

  const { data, error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .download(key);

  if (error || !data) {
    throw new Error(
      `Supabase download failed for ${key}: ${error?.message ?? "not found"}`
    );
  }

  return Buffer.from(await data.arrayBuffer());
}

export async function removeDocument(objectKey: string): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const key = assertSafeObjectKey(objectKey);

  const { error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .remove([key]);

  if (error) {
    throw new Error(`Supabase delete failed for ${key}: ${error.message}`);
  }
}
