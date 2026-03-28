"use client";

import { useRef } from "react";
import { CopyIcon, MailIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ShareLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shareUrl: string;
  quoteNumber: string | null;
  recipientEmail: string | null;
}

export function ShareLinkDialog({
  open,
  onOpenChange,
  shareUrl,
  quoteNumber,
  recipientEmail,
}: ShareLinkDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleCopy() {
    navigator.clipboard.writeText(shareUrl).then(() => {
      toast.success("Link copied!");
      inputRef.current?.select();
    });
  }

  function handleEmail() {
    const subject = encodeURIComponent(
      `Quote ${quoteNumber ?? ""} from Los Angeles Pierce College`
    );
    const body = encodeURIComponent(
      `Hello,\n\nPlease review the following quote:\n\n${shareUrl}\n\nThank you.`
    );
    const to = recipientEmail ? encodeURIComponent(recipientEmail) : "";
    window.open(`mailto:${to}?subject=${subject}&body=${body}`, "_self");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share Quote Link</DialogTitle>
          <DialogDescription>
            Send this link to your recipient so they can review and respond to the quote.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              readOnly
              value={shareUrl}
              className="flex-1 rounded-md border border-input bg-muted px-3 py-2 text-sm font-mono select-all"
              onFocus={(e) => e.target.select()}
            />
            <Button variant="outline" size="sm" onClick={handleCopy} title="Copy to clipboard">
              <CopyIcon className="size-4 mr-1.5" />
              Copy
            </Button>
          </div>
          <Button className="w-full" onClick={handleEmail}>
            <MailIcon className="size-4 mr-2" />
            Email Link
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
