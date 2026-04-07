"use client";

import { useState } from "react";
import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";

const sections = [
  {
    title: "Creating an Invoice",
    body: "Click New Invoice. Select the requesting staff member — their info auto-fills and becomes the Department Contact on the IDP. Then choose a category and enter the account number and account code.",
  },
  {
    title: "Adding Items",
    body: "Type items manually or use Quick Picks (pre-configured items for each department). Save frequently used items with the bookmark icon.",
  },
  {
    title: "Approvers",
    body: "Select up to 3 approvers from the staff directory for the signature lines at the bottom of the forms. The system remembers who approved for each requestor.",
  },
  {
    title: "Generating the PDF",
    body: "Click Generate Invoice PDF. The system creates a CoverSheet and IDP form matching the official Pierce College format.",
  },
  {
    title: "Managing Invoices",
    body: "View all invoices on the Invoices page. Search by invoice number, staff, department, or even line item descriptions. Export to CSV for external analysis.",
  },
  {
    title: "Analytics",
    body: "Visit the Analytics page to see spending by category, department, and monthly trends.",
  },
];

export function HelpModal() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Help"
          >
            <HelpCircle className="size-4" />
            <span className="sr-only">Help</span>
          </Button>
        }
      />
      <DialogContent className="sm:max-w-lg" showCloseButton>
        <DialogHeader>
          <DialogTitle>How to Use LAPortal</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {sections.map((section) => (
            <div key={section.title}>
              <h3 className="text-sm font-semibold mb-0.5">{section.title}</h3>
              <p className="text-sm text-muted-foreground">{section.body}</p>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button onClick={() => setOpen(false)}>Got it</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
