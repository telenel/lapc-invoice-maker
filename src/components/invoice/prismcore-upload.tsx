"use client";

import { useRef, useState } from "react";
import { UploadIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { uploadApi } from "@/domains/upload/api-client";

interface PrismcoreUploadProps {
  value: string | null;
  onChange: (path: string | null) => void;
}

export function PrismcoreUpload({ value, onChange }: PrismcoreUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [filename, setFilename] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const data = await uploadApi.uploadPdf(file);
      setFilename(data.filename);
      onChange(data.path);
    } catch {
      toast.error("Failed to upload PrismCore PDF. Please try again.");
      if (inputRef.current) inputRef.current.value = "";
    } finally {
      setUploading(false);
    }
  }

  function handleRemove() {
    setFilename(null);
    onChange(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="space-y-1.5">
      <Label>PrismCore Invoice (optional)</Label>

      <input
        ref={inputRef}
        type="file"
        accept=".pdf"
        onChange={handleFileChange}
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
      />

      {uploading ? (
        <p className="text-sm text-muted-foreground" aria-live="polite">Uploading…</p>
      ) : value ? (
        <div className="flex items-center gap-2">
          <span className="text-sm truncate max-w-xs">{filename ?? value}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRemove}
          >
            Remove
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          onClick={() => inputRef.current?.click()}
          className="gap-2"
        >
          <UploadIcon className="size-4" aria-hidden="true" />
          Choose PDF
        </Button>
      )}
    </div>
  );
}
