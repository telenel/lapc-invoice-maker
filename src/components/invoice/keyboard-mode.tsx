"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import { InfoIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { InlineCombobox } from "@/components/ui/inline-combobox";
import type { ComboboxItem } from "@/components/ui/inline-combobox";
import { LineItems } from "./line-items";
import { QuickPicksSidePanel } from "./quick-picks-side-panel";
import { PrismcoreUpload } from "./prismcore-upload";
import { PdfProgress } from "./pdf-progress";
import { StaffSummaryEditor } from "./staff-summary-editor";
import { SignatureSection } from "./signature-section";
import { InvoiceMetadata } from "./invoice-metadata";
import { cn } from "@/lib/utils";
import type {
  InvoiceFormData,
  InvoiceItem,
  StaffAccountNumber,
  GenerationStep,
} from "./invoice-form";
import { staffApi } from "@/domains/staff/api-client";
import type { StaffResponse, StaffDetailResponse } from "@/domains/staff/types";
import { categoryApi } from "@/domains/category/api-client";
import { quickPicksApi } from "@/domains/quick-picks/api-client";
import { savedItemsApi } from "@/domains/saved-items/api-client";
import { userQuickPicksApi } from "@/domains/user-quick-picks/api-client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Category {
  id: string;
  name: string;
  label: string;
  active: boolean;
}

interface KeyboardModeProps {
  form: InvoiceFormData;
  updateField: <K extends keyof InvoiceFormData>(
    key: K,
    value: InvoiceFormData[K]
  ) => void;
  updateItem: (index: number, patch: Partial<InvoiceItem>) => void;
  addItem: () => void;
  removeItem: (index: number) => void;
  total: number;
  itemsWithMargin: InvoiceItem[];
  subtotal: number;
  taxAmount: number;
  grandTotal: number;
  handleStaffSelect: (staff: StaffDetailResponse) => void;
  handleStaffEdit: (updated: StaffDetailResponse) => void;
  staffAccountNumbers: StaffAccountNumber[];
  saveDraft: () => Promise<void>;
  saveAndFinalize: () => Promise<void>;
  savePendingCharge: () => Promise<void>;
  saving: boolean;
  generationStep: GenerationStep;
  isPendingCharge?: boolean;
  existingId?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function SectionDivider({
  label,
  children,
}: {
  label: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 pt-6 pb-2">
      <span className="section-label">{label}</span>
      <div className="flex-1 border-t border-border" />
      {children}
    </div>
  );
}

export function KeyboardMode({
  form,
  updateField,
  updateItem,
  addItem,
  removeItem,
  total,
  itemsWithMargin,
  subtotal,
  taxAmount,
  grandTotal,
  handleStaffSelect,
  staffAccountNumbers,
  saveDraft,
  saveAndFinalize,
  savePendingCharge,
  saving,
  generationStep,
  isPendingCharge = false,
  existingId,
}: KeyboardModeProps) {
  // ---- Local state ----
  const [staff, setStaff] = useState<StaffResponse[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [staffLoading, setStaffLoading] = useState(true);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [suggestions, setSuggestions] = useState<{ description: string; unitPrice: number }[]>([]);
  const [userPickDescriptions, setUserPickDescriptions] = useState<Set<string>>(new Set());
  const [userPicks, setUserPicks] = useState<{ id: string; description: string; unitPrice: number; department: string }[]>([]);
  const [isMac, setIsMac] = useState(false);

  const [showChargeLaterDialog, setShowChargeLaterDialog] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const invoiceNumberRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isPendingCharge && invoiceNumberRef.current) {
      invoiceNumberRef.current.select();
    }
  }, [isPendingCharge]);

  // ---- Data fetching ----
  useEffect(() => {
    staffApi.list()
      .then((data: StaffResponse[]) => {
        setStaff(data);
        if (form.staffId) {
          const match = data.find((s: StaffResponse) => s.id === form.staffId);
          if (match) handleStaffSelect(match as StaffDetailResponse);
        }
      })
      .catch(() => {})
      .finally(() => setStaffLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    categoryApi.list()
      .then((data) => setCategories(data))
      .catch(() => {})
      .finally(() => setCategoriesLoading(false));
  }, []);

  // ---- Autocomplete + user picks fetch ----
  useEffect(() => {
    if (!form.department) return;
    let cancelled = false;

    Promise.all([
      quickPicksApi.list(form.department).catch(() => []),
      savedItemsApi.list(form.department).catch(() => []),
      userQuickPicksApi.list(form.department).catch(() => []),
    ]).then(([picks, saved, uPicks]) => {
      if (cancelled) return;
      const combined = new Map<string, { description: string; unitPrice: number }>();
      for (const p of picks) combined.set(p.description, { description: p.description, unitPrice: Number(p.defaultPrice) });
      for (const s of saved) combined.set(s.description, { description: s.description, unitPrice: Number(s.unitPrice) });
      for (const u of uPicks) combined.set(u.description, { description: u.description, unitPrice: Number(u.unitPrice) });
      setSuggestions(Array.from(combined.values()));
      setUserPicks(uPicks);
      setUserPickDescriptions(new Set(uPicks.map((p: { description: string }) => p.description)));
    });

    return () => { cancelled = true; };
  }, [form.department]);

  // ---- Platform detection ----
  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad|iPod/.test(navigator.userAgent));
  }, []);

  // ---- Validation + generate ----
  const handleGenerate = useCallback(() => {
    if (!form.staffId) {
      toast.error("Please select a staff member");
      return;
    }
    if (!form.invoiceNumber) {
      toast.error("Please enter an invoice number");
      return;
    }
    if (!form.category) {
      toast.error("Please select a category");
      return;
    }
    saveAndFinalize();
  }, [form.staffId, form.invoiceNumber, form.category, saveAndFinalize]);

  // ---- Keyboard shortcut: Ctrl/Cmd+Enter -> Generate PDF ----
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        handleGenerate();
      }
    }
    const el = containerRef.current;
    if (el) {
      el.addEventListener("keydown", handleKeyDown);
      return () => el.removeEventListener("keydown", handleKeyDown);
    }
  }, [handleGenerate]);

  // ---- Quick pick handler ----
  function handleQuickPick(description: string, unitPrice: number) {
    const emptyIndex = form.items.findIndex((item) => !item.description);
    if (emptyIndex >= 0) {
      updateItem(emptyIndex, {
        description,
        unitPrice,
        quantity: 1,
        extendedPrice: unitPrice,
      });
    } else {
      addItem();
      const newIndex = form.items.length;
      setTimeout(
        () =>
          updateItem(newIndex, {
            description,
            unitPrice,
            quantity: 1,
            extendedPrice: unitPrice,
          }),
        0
      );
    }
  }

  // ---- Star toggle handler ----
  async function handleTogglePick(description: string, unitPrice: number, department: string) {
    const dept = department || "__ALL__";
    const descUpper = description.toUpperCase();
    const existingPick = userPicks.find(
      (p) => p.description.toUpperCase() === descUpper && (p.department === dept || p.department === department)
    );
    if (existingPick) {
      await userQuickPicksApi.delete(existingPick.id);
      setUserPicks((prev) => prev.filter((p) => p.id !== existingPick.id));
      setUserPickDescriptions((prev) => {
        const next = new Set(prev);
        next.delete(existingPick.description);
        return next;
      });
      toast.success(`"${description}" removed from quick picks`);
    } else {
      try {
        const newPick = await userQuickPicksApi.create({ description, unitPrice, department: dept });
        setUserPicks((prev) => [...prev, newPick]);
        setUserPickDescriptions((prev) => new Set(prev).add(description));
        toast.success(`"${description}" saved to quick picks`);
      } catch {
        toast.error("Failed to save quick pick");
      }
    }
  }

  // ---- Staff combobox items ----
  const staffItems: ComboboxItem[] = staff.map((s) => ({
    id: s.id,
    label: s.name,
    sublabel: s.department,
    searchValue: `${s.name} ${s.department} ${s.title}`,
  }));

  // ---- Staff select handler ----
  function handleStaffComboboxSelect(item: ComboboxItem) {
    const found = staff.find((s) => s.id === item.id);
    if (!found) return;
    handleStaffSelect(found as StaffDetailResponse);
  }

  return (
    <div
      ref={containerRef}
      className="keyboard-mode max-w-2xl mx-auto"
      tabIndex={-1}
    >
      {isPendingCharge && (
        <div className="rounded-lg border-l-4 border-l-amber-500 bg-amber-50 dark:bg-amber-950/20 p-4 mb-4">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
            This invoice needs a POS charge. Enter the AG number and upload the PrismCore PDF to finalize.
          </p>
        </div>
      )}

      {/* ============ STAFF ============ */}
      <SectionDivider label="STAFF" />

      <div className="space-y-3">
        <div className="space-y-1">
          <label className="text-sm font-medium">Staff Member</label>
          <InlineCombobox
            items={staffItems}
            value={form.staffId}
            displayValue={form.contactName}
            onSelect={handleStaffComboboxSelect}
            placeholder="Search staff…"
            loading={staffLoading}
          />
        </div>

        {/* Auto-filled summary row */}
        <StaffSummaryEditor form={form} updateField={updateField} />
      </div>

      {/* ============ INVOICE ============ */}
      <SectionDivider label="INVOICE" />

      <InvoiceMetadata
        form={form}
        updateField={updateField}
        categories={categories}
        categoriesLoading={categoriesLoading}
        staffAccountNumbers={staffAccountNumbers}
        isPendingCharge={isPendingCharge}
        invoiceNumberRef={invoiceNumberRef}
      />

      {/* ============ PRICING ============ */}
      <SectionDivider label="PRICING" />

      <div className="space-y-3">
        {/* Apply Margin */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Checkbox
              id="marginEnabled"
              checked={form.marginEnabled}
              onCheckedChange={(checked) =>
                updateField("marginEnabled", checked === true)
              }
            />
            <Label
              htmlFor="marginEnabled"
              className="text-sm font-medium cursor-pointer"
            >
              Apply Margin
            </Label>
          </div>
          {form.marginEnabled && (
            <div className="flex items-center gap-1">
              <Input
                type="number"
                min={0}
                max={100}
                step={1}
                value={form.marginPercent}
                onChange={(e) =>
                  updateField("marginPercent", Number(e.target.value))
                }
                className="w-20 h-7 text-sm"
                aria-label="Margin percentage"
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
          )}
        </div>
        {form.marginEnabled && (
          <span className="text-xs text-muted-foreground italic">
            Margin is internal only — the customer sees the final price, not the markup
          </span>
        )}

        {/* Apply Sales Tax */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Checkbox
              id="taxEnabled"
              checked={form.taxEnabled}
              onCheckedChange={(checked) =>
                updateField("taxEnabled", checked === true)
              }
            />
            <Label
              htmlFor="taxEnabled"
              className="text-sm font-medium cursor-pointer"
            >
              Apply Sales Tax{" "}
              <span className="text-muted-foreground font-normal">
                (9.75%)
              </span>
            </Label>
          </div>

          {/* CA Tax Rules info */}
          <Popover>
            <PopoverTrigger
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <InfoIcon className="size-3.5" />
              <span>CA Tax Rules</span>
            </PopoverTrigger>
            <PopoverContent side="bottom" align="start" className="w-80">
              <div className="space-y-2 text-xs">
                <p className="font-semibold text-sm">
                  California Food Tax Rules
                </p>
                <ul className="space-y-1.5 list-disc pl-4">
                  <li>
                    <strong>Hot prepared food</strong> — always taxable
                  </li>
                  <li>
                    <strong>Cold food to-go</strong> (no eating establishment)
                    — usually exempt
                  </li>
                  <li>
                    <strong>Catering</strong> (food + service) — always fully
                    taxable
                  </li>
                  <li>
                    <strong>Carbonated beverages, candy</strong> — always
                    taxable
                  </li>
                </ul>
                <p className="text-muted-foreground pt-1">
                  Source: CDTFA Regulation 1603
                </p>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* ============ LINE ITEMS ============ */}
      <SectionDivider label="LINE ITEMS" />

      <div className="space-y-3">
        <div className="flex gap-4">
          <div className="flex-1 min-w-0">
            <LineItems
              items={form.items}
              onUpdate={updateItem}
              onAdd={addItem}
              onRemove={removeItem}
              total={total}
              department={form.department}
              suggestions={suggestions}
              userPickDescriptions={userPickDescriptions}
              onTogglePick={handleTogglePick}
              marginEnabled={form.marginEnabled}
              itemsWithMargin={itemsWithMargin}
              taxEnabled={form.taxEnabled}
            />
          </div>
          <QuickPicksSidePanel
            department={form.department}
            currentSubtotal={total}
            onSelect={handleQuickPick}
          />
        </div>

        {/* Notes */}
        <div className="space-y-1">
          <label className="text-sm font-medium">Notes</label>
          <Textarea
            value={form.notes}
            onChange={(e) => updateField("notes", e.target.value)}
            placeholder="Additional notes or comments…"
            name="notes"
            rows={3}
          />
        </div>
      </div>

      {/* ============ TOTALS ============ */}
      <Separator className="mt-6" />

      <div className="pt-4 space-y-1.5 text-sm tabular-nums">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Subtotal</span>
          <span>
            ${subtotal.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
        </div>

        {form.marginEnabled && (form.marginPercent ?? 0) > 0 && (
          <div className="flex justify-between text-violet-600">
            <span>Margin (+{form.marginPercent}%) included</span>
            <span />
          </div>
        )}

        {form.taxEnabled && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">
              CA Sales Tax (9.75% on taxable items)
            </span>
            <span>
              ${taxAmount.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </div>
        )}

        <Separator />

        <div className="flex justify-between text-lg font-semibold">
          <span>Total</span>
          <span>
            ${grandTotal.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
        </div>
      </div>

      {/* ============ SIGNATURES ============ */}
      <SectionDivider label="SIGNATURES" />

      <SignatureSection
        form={form}
        updateField={updateField}
        staff={staff}
        staffLoading={staffLoading}
      />

      {/* ============ PRISMCORE + ACTIONS ============ */}
      <div className="pt-6 space-y-4">
        <div className={cn(
          isPendingCharge && !form.prismcorePath &&
            "rounded-lg border-l-4 border-l-primary bg-primary/5 p-2 -ml-2"
        )}>
          <PrismcoreUpload
            value={form.prismcorePath}
            onChange={(path) => updateField("prismcorePath", path)}
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          {!form.isRunning && (
            <Button variant="outline" tabIndex={-1} onClick={saveDraft} disabled={saving}>
              Save Draft
            </Button>
          )}
          {!form.isRunning && !existingId && (
            <Button variant="secondary" tabIndex={-1} onClick={() => setShowChargeLaterDialog(true)} disabled={saving}>
              Charge Later
            </Button>
          )}
          {form.isRunning ? (
            <Button onClick={saveDraft} disabled={saving}>
              Save Running Invoice
            </Button>
          ) : existingId ? (
            <Button onClick={saveDraft} disabled={saving}>
              {saving ? "Updating..." : "Update"}
            </Button>
          ) : (
            <Button onClick={handleGenerate} disabled={saving}>
              Generate PDF {isMac ? "\u2318\u21B5" : "Ctrl\u21B5"}
            </Button>
          )}
        </div>
      </div>

      <PdfProgress step={generationStep} />

      <Dialog open={showChargeLaterDialog} onOpenChange={setShowChargeLaterDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Charge Later</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              This will save the invoice as a <strong className="text-foreground">Pending Charge</strong>. Here&apos;s what happens next:
            </p>
            <ol className="list-decimal list-inside space-y-2">
              <li>The invoice is saved without an invoice number or final PDF.</li>
              <li>It will appear in your <strong className="text-foreground">Pending POS Charges</strong> on the dashboard.</li>
              <li>When you&apos;re ready, open the pending charge, enter the AG invoice number, upload the PrismCore PDF, and finalize.</li>
            </ol>
            <p>
              Use this when you need to create the invoice now but charge at the register later.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowChargeLaterDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setShowChargeLaterDialog(false);
                savePendingCharge();
              }}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save as Pending Charge"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
