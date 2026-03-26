"use client";

import { useState, useEffect } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useInvoiceForm } from "@/components/invoice/invoice-form";
import { WizardMode } from "@/components/invoice/wizard-mode";
import { QuickMode } from "@/components/invoice/quick-mode";

type Mode = "wizard" | "quick";

const STORAGE_KEY = "lapc-invoice-mode";

export default function NewInvoicePage() {
  const [mode, setMode] = useState<Mode>("wizard");

  // Hydrate mode preference from localStorage after mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "wizard" || stored === "quick") {
      setMode(stored);
    }
  }, []);

  function handleModeChange(value: Mode) {
    setMode(value);
    localStorage.setItem(STORAGE_KEY, value);
  }

  const invoiceForm = useInvoiceForm();

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-semibold">New Invoice</h1>
        <Tabs
          value={mode}
          onValueChange={(value) => handleModeChange(value as Mode)}
        >
          <TabsList>
            <TabsTrigger value="wizard">Wizard</TabsTrigger>
            <TabsTrigger value="quick">Quick</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <p className="text-xs text-muted-foreground mb-6 text-right">
        Wizard walks you through step-by-step. Quick shows everything at once.
      </p>

      {/* Mode content */}
      {mode === "wizard" ? (
        <WizardMode {...invoiceForm} />
      ) : (
        <QuickMode {...invoiceForm} />
      )}
    </div>
  );
}
