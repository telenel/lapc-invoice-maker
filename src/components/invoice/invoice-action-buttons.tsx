"use client";

import { Button } from "@/components/ui/button";

interface InvoiceActionButtonsProps {
  isRunning: boolean;
  existingId?: string;
  saving: boolean;
  prismcoreUploading: boolean;
  isMac: boolean;
  onSaveAsTemplate: () => void;
  onSaveDraft: () => void;
  onGenerate: () => void;
}

export function InvoiceActionButtons({
  isRunning,
  existingId,
  saving,
  prismcoreUploading,
  isMac,
  onSaveAsTemplate,
  onSaveDraft,
  onGenerate,
}: InvoiceActionButtonsProps) {
  const actionsDisabled = saving || prismcoreUploading;

  if (isRunning) {
    return (
      <Button
        onClick={onSaveDraft}
        disabled={actionsDisabled}
        className="w-full sm:w-auto"
      >
        Save Running Invoice
      </Button>
    );
  }

  if (existingId) {
    return (
      <>
        <Button
          onClick={onSaveDraft}
          disabled={actionsDisabled}
          className="w-full sm:w-auto"
        >
          {saving ? "Updating..." : "Update"}
        </Button>
        <Button
          onClick={onGenerate}
          disabled={actionsDisabled}
          className="w-full sm:w-auto"
        >
          {`Generate PDF ${isMac ? "\u2318\u21B5" : "Ctrl\u21B5"}`}
        </Button>
      </>
    );
  }

  return (
    <>
      <Button
        variant="outline"
        onClick={onSaveAsTemplate}
        disabled={actionsDisabled}
        className="w-full sm:w-auto"
      >
        Save as Template
      </Button>
      <Button
        variant="outline"
        onClick={onSaveDraft}
        disabled={actionsDisabled}
        className="w-full sm:w-auto"
      >
        Save Draft
      </Button>
      <Button
        onClick={onGenerate}
        disabled={actionsDisabled}
        className="w-full sm:w-auto"
      >
        Generate PDF {isMac ? "\u2318\u21B5" : "Ctrl\u21B5"}
      </Button>
    </>
  );
}
