import { readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const DOCUMENTS_BUCKET = "laportal-documents";
const LEGACY_PDFS_DIR = path.resolve(process.cwd(), "data/pdfs");
const LEGACY_UPLOADS_DIR = path.resolve(process.cwd(), "public/uploads");

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

function resolveLegacyLocalPath(objectKey: string): string | null {
  const normalized = objectKey.trim().replace(/^\/+/, "");
  if (!normalized || normalized.includes("..") || normalized.includes("\\")) {
    return null;
  }

  if (normalized.startsWith("public/uploads/")) {
    return path.resolve(process.cwd(), normalized);
  }

  if (normalized.startsWith("uploads/")) {
    return path.join(LEGACY_UPLOADS_DIR, normalized.slice("uploads/".length));
  }

  if (normalized.startsWith("data/pdfs/")) {
    return path.resolve(process.cwd(), normalized);
  }

  if (normalized.startsWith("pdfs/")) {
    return path.join(LEGACY_PDFS_DIR, normalized.slice("pdfs/".length));
  }

  return null;
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
    const legacyLocalPath = resolveLegacyLocalPath(objectKey);
    if (legacyLocalPath) {
      try {
        return await readFile(legacyLocalPath);
      } catch {
        // Fall through to the Supabase error below.
      }
    }

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

  const legacyLocalPath = resolveLegacyLocalPath(objectKey);
  if (legacyLocalPath) {
    await unlink(legacyLocalPath).catch((unlinkError: NodeJS.ErrnoException) => {
      if (unlinkError.code !== "ENOENT") {
        throw unlinkError;
      }
    });
  }
}
