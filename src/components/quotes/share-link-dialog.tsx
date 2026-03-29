"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircleIcon, CopyIcon, MailIcon } from "lucide-react";
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
import { EmailProgress, type EmailStep } from "./email-progress";

interface LogEntry {
  timestamp: string;
  message: string;
  status?: "ok" | "error" | "pending";
}

interface ShareLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shareUrl: string;
  quoteNumber: string | null;
  recipientEmail: string | null;
  recipientName: string | null;
  quoteId: string;
}

function ts(): string {
  return new Date().toLocaleTimeString("en-US", { hour12: false });
}

export function ShareLinkDialog({
  open,
  onOpenChange,
  shareUrl,
  quoteNumber,
  recipientEmail,
  recipientName,
  quoteId,
}: ShareLinkDialogProps) {
  const linkInputRef = useRef<HTMLInputElement>(null);
  const [emailAvailable, setEmailAvailable] = useState<boolean | null>(null);
  const [toAddress, setToAddress] = useState(recipientEmail ?? "");
  const [sent, setSent] = useState(false);

  // Email progress state
  const [emailStep, setEmailStep] = useState<EmailStep>(null);
  const [emailLogs, setEmailLogs] = useState<LogEntry[]>([]);
  const [emailError, setEmailError] = useState<string>();

  const addLog = useCallback((message: string, status?: "ok" | "error" | "pending") => {
    setEmailLogs((prev) => [...prev, { timestamp: ts(), message, status }]);
  }, []);

  // Check email availability when dialog opens
  useEffect(() => {
    if (!open) {
      setSent(false);
      return;
    }
    setToAddress(recipientEmail ?? "");
    let cancelled = false;
    fetch("/api/email/status")
      .then((res) => (res.ok ? res.json() : { available: false }))
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
    const email = toAddress.trim();
    if (!email) {
      toast.error("Please enter a recipient email address");
      return;
    }

    // Reset and start progress
    setEmailLogs([]);
    setEmailError(undefined);
    setEmailStep("validating");
    addLog(`Validating recipient: ${email}`, "pending");

    // Step 1: Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    await delay(400);
    if (!emailRegex.test(email)) {
      addLog(`Invalid email format: ${email}`, "error");
      setEmailStep("error");
      setEmailError("Invalid email address format");
      return;
    }
    addLog(`Recipient validated: ${email}`, "ok");

    // Step 2: Connect
    setEmailStep("connecting");
    addLog(`Building email template: quote-share`, "ok");
    addLog(`Connecting to Power Automate webhook...`, "pending");
    await delay(300);

    // Step 3: Send
    setEmailStep("sending");
    addLog(`POST email-service/send`, "pending");

    try {
      const res = await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "quote-share",
          to: email,
          data: { quoteNumber, recipientName, shareUrl },
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        const detail = data.detail ?? "unknown";
        addLog(`Response: ${res.status} ${res.statusText}`, "error");
        addLog(`Detail: ${detail}`, "error");
        setEmailStep("error");
        setEmailError(data.error ?? "Failed to send email");
        return;
      }

      const data = await res.json();
      addLog(`Response: 202 Accepted`, "ok");
      addLog(`Email queued for delivery to ${data.recipient}`, "ok");

      // Upgrade status to SUBMITTED_EMAIL
      try {
        await fetch(`/api/quotes/${quoteId}/mark-submitted`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ method: "email" }),
        });
      } catch {
        // Non-critical — status upgrade is best-effort
      }

      // Step 4: Done — stays visible until user clicks "Done"
      setEmailStep("done");
    } catch {
      addLog(`Connection failed: network error`, "error");
      setEmailStep("error");
      setEmailError("Network error — check your connection");
    }
  }

  function handleRetry() {
    setEmailStep(null);
    setEmailLogs([]);
    setEmailError(undefined);
    handleSendEmail();
  }

  function handleCloseProgress() {
    const wasDone = emailStep === "done";
    setEmailStep(null);
    setEmailLogs([]);
    setEmailError(undefined);
    if (wasDone) {
      setSent(true);
      toast.success("Email sent!");
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
    <>
      {/* Email progress overlay */}
      <EmailProgress
        step={emailStep}
        recipientEmail={toAddress}
        logs={emailLogs}
        error={emailError}
        onClose={handleCloseProgress}
        onRetry={handleRetry}
      />

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
                  disabled={!toAddress.trim()}
                >
                  <MailIcon className="size-4 mr-2" />
                  Send Email
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
    </>
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
