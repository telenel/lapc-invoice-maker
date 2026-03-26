"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "lapc-welcome-dismissed";

export function WelcomeBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (!dismissed) {
      setVisible(true);
    }
  }, []);

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, "true");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="py-4 px-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <p className="font-semibold text-sm">Welcome to LAPC InvoiceMaker</p>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>
                Select a staff member and their department, contact info, and account numbers auto-fill.
              </li>
              <li>
                Account numbers are saved per person — the most recent one loads automatically.
              </li>
              <li>
                Signature approvers are remembered per staff member.
              </li>
              <li>
                Use <strong>Quick Picks</strong> or save your own line items for one-click reuse.
              </li>
              <li>
                Categorize each invoice (CopyTech, Catering, Supplies, Dept Purchase) for analytics tracking.
              </li>
              <li>
                Export your invoices to CSV anytime from the <strong>Invoices</strong> page.
              </li>
            </ul>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0 h-7 px-2 text-xs"
            onClick={dismiss}
            aria-label="Dismiss welcome banner"
          >
            Got it
            <X className="ml-1 size-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
