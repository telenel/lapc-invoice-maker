"use client";

import { useState, useEffect } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useInvoiceForm } from "@/components/invoice/invoice-form";
import { WizardMode } from "@/components/invoice/wizard-mode";
import { QuickMode } from "@/components/invoice/quick-mode";
import { KeyboardMode } from "@/components/invoice/keyboard-mode";

type Mode = "keyboard" | "wizard" | "quick";

const STORAGE_KEY = "lapc-invoice-mode";

export default function NewInvoicePage() {
  const [mode, setMode] = useState<Mode>("keyboard");

  // Hydrate mode preference from localStorage after mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "keyboard" || stored === "wizard" || stored === "quick") {
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
        <h1 className="text-2xl font-semibold text-balance">New Invoice</h1>
        <Tabs
          value={mode}
          onValueChange={(value) => handleModeChange(value as Mode)}
        >
          <TabsList>
            <TabsTrigger value="keyboard">Keyboard</TabsTrigger>
            <TabsTrigger value="wizard">Wizard</TabsTrigger>
            <TabsTrigger value="quick">Quick</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <p className="text-xs text-muted-foreground mb-6 text-right">
        {mode === "keyboard" && "Tab through fields to create invoices fast."}
        {mode === "wizard" && "Step-by-step guided flow."}
        {mode === "quick" && "Everything visible at once."}
      </p>

      {/* Mode content */}
      {mode === "keyboard" && <KeyboardMode {...invoiceForm} />}
      {mode === "wizard" && <WizardMode {...invoiceForm} />}
      {mode === "quick" && <QuickMode {...invoiceForm} />}
    </div>
  );
}
