"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

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
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Upload failed");

      const data = (await res.json()) as { path: string; filename: string };
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
    <div className="space-y-1">
      <Label htmlFor="prismcore-upload">PrismCore Invoice (optional)</Label>

      {uploading ? (
        <p className="text-sm text-muted-foreground">Uploading...</p>
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
        <Input
          ref={inputRef}
          id="prismcore-upload"
          type="file"
          accept=".pdf"
          onChange={handleFileChange}
          className="cursor-pointer"
        />
      )}
    </div>
  );
}
