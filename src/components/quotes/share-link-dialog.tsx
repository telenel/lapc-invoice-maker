"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircleIcon, CopyIcon, MailIcon, LoaderIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ShareLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shareUrl: string;
  quoteNumber: string | null;
  recipientEmail: string | null;
  recipientName: string | null;
}

export function ShareLinkDialog({
  open,
  onOpenChange,
  shareUrl,
  quoteNumber,
  recipientEmail,
  recipientName,
}: ShareLinkDialogProps) {
  const linkInputRef = useRef<HTMLInputElement>(null);
  const [emailAvailable, setEmailAvailable] = useState<boolean | null>(null);
  const [toAddress, setToAddress] = useState(recipientEmail ?? "");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  // Check email availability when dialog opens
  useEffect(() => {
    if (!open) {
      setSent(false);
      return;
    }
    setToAddress(recipientEmail ?? "");
    let cancelled = false;
    fetch("/api/email/status")
      .then((res) => res.json())
      .then((data: { available: boolean }) => {
        if (!cancelled) setEmailAvailable(data.available);
      })
      .catch(() => {
        if (!cancelled) setEmailAvailable(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, recipientEmail]);

  function handleCopy() {
    navigator.clipboard.writeText(shareUrl).then(() => {
      toast.success("Link copied!");
      linkInputRef.current?.select();
    });
  }

  async function handleSendEmail() {
    if (!toAddress.trim()) {
      toast.error("Please enter a recipient email address");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "quote-share",
          to: toAddress.trim(),
          data: {
            quoteNumber,
            recipientName,
            shareUrl,
          },
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Failed to send email");
      } else {
        setSent(true);
        toast.success("Email sent!");
      }
    } catch {
      toast.error("Failed to send email");
    } finally {
      setSending(false);
    }
  }

  // Loading state
  if (emailAvailable === null && open) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share Quote Link</DialogTitle>
            <DialogDescription>Loading...</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share Quote Link</DialogTitle>
          <DialogDescription>
            {emailAvailable
              ? "Send this quote to your recipient via email, or copy the link to share manually."
              : "Email is not available. Copy the link below and send it manually."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Email section — shown when email is available */}
          {emailAvailable && !sent && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="share-email-to">Recipient Email</Label>
                <Input
                  id="share-email-to"
                  type="email"
                  placeholder="recipient@example.com"
                  value={toAddress}
                  onChange={(e) => setToAddress(e.target.value)}
                />
              </div>

              {/* Preview */}
              <div className="rounded-md border bg-muted/50 p-3 text-sm space-y-1">
                <p className="text-muted-foreground">
                  <span className="font-medium text-foreground">To:</span> {toAddress || "—"}
                </p>
                <p className="text-muted-foreground">
                  <span className="font-medium text-foreground">Subject:</span>{" "}
                  {`Quote ${quoteNumber ?? ""} from Los Angeles Pierce College`.trim()}
                </p>
                <p className="text-muted-foreground">
                  <span className="font-medium text-foreground">Quote:</span>{" "}
                  {quoteNumber ?? "—"}
                </p>
              </div>

              <Button
                className="w-full"
                onClick={handleSendEmail}
                disabled={sending || !toAddress.trim()}
              >
                {sending ? (
                  <>
                    <LoaderIcon className="size-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <MailIcon className="size-4 mr-2" />
                    Send Email
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Success state after email sent */}
          {emailAvailable && sent && (
            <div className="flex flex-col items-center gap-2 py-4">
              <CheckCircleIcon className="size-8 text-green-600" />
              <p className="text-sm font-medium">Email sent to {toAddress}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSent(false)}
                className="mt-2"
              >
                Send to Another Recipient
              </Button>
            </div>
          )}

          {/* Divider when email is available */}
          {emailAvailable && (
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  or copy link
                </span>
              </div>
            </div>
          )}

          {/* Copy link section — always visible */}
          <div className="flex gap-2">
            <input
              ref={linkInputRef}
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
