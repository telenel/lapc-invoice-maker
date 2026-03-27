"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { InlineCombobox } from "@/components/ui/inline-combobox";
import type { ComboboxItem } from "@/components/ui/inline-combobox";
import { LineItems } from "./line-items";
import { QuickPicksSidePanel } from "./quick-picks-side-panel";
import { PrismcoreUpload } from "./prismcore-upload";
import { PdfProgress } from "./pdf-progress";
import { cn } from "@/lib/utils";
import type {
  InvoiceFormData,
  InvoiceItem,
  StaffAccountNumber,
  GenerationStep,
} from "./invoice-form";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StaffMember {
  id: string;
  name: string;
  title: string;
  department: string;
  accountCode: string;
  extension: string;
  email: string;
  phone: string;
  approvalChain: string[];
  active: boolean;
}

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
  handleStaffSelect: (staff: StaffMember) => void;
  handleStaffEdit: (updated: StaffMember) => void;
  staffAccountNumbers: StaffAccountNumber[];
  saveDraft: () => Promise<void>;
  saveAndFinalize: () => Promise<void>;
  savePendingCharge: () => Promise<void>;
  saving: boolean;
  generationStep: GenerationStep;
  isPendingCharge?: boolean;
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
  handleStaffSelect,
  staffAccountNumbers,
  saveDraft,
  saveAndFinalize,
  savePendingCharge,
  saving,
  generationStep,
  isPendingCharge = false,
}: KeyboardModeProps) {
  // ---- Local state ----
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [staffLoading, setStaffLoading] = useState(true);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [suggestions, setSuggestions] = useState<{ description: string; unitPrice: number }[]>([]);
  const [userPickDescriptions, setUserPickDescriptions] = useState<Set<string>>(new Set());
  const [userPicks, setUserPicks] = useState<{ id: string; description: string; unitPrice: number; department: string }[]>([]);
  const [marginPercent, setMarginPercent] = useState("");
  const [isMac, setIsMac] = useState(false);

  // Inline editing for staff summary fields
  const [editingField, setEditingField] = useState<
    "department" | "contactExtension" | "contactEmail" | "contactPhone" | null
  >(null);

  // New account number flow
  const [newAccountDescription, setNewAccountDescription] = useState("");
  const [showAccountDescInput, setShowAccountDescInput] = useState(false);
  const [pendingAccountCode, setPendingAccountCode] = useState("");

  const containerRef = useRef<HTMLDivElement>(null);
  const invoiceNumberRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isPendingCharge && invoiceNumberRef.current) {
      invoiceNumberRef.current.select();
    }
  }, [isPendingCharge]);

  // ---- Data fetching ----
  useEffect(() => {
    fetch("/api/staff")
      .then((res) => res.json())
      .then((data: StaffMember[]) => setStaff(data))
      .catch(() => {})
      .finally(() => setStaffLoading(false));
  }, []);

  useEffect(() => {
    fetch("/api/categories")
      .then((res) => res.json())
      .then((data: Category[]) => setCategories(data))
      .catch(() => {})
      .finally(() => setCategoriesLoading(false));
  }, []);

  // ---- Autocomplete + user picks fetch ----
  useEffect(() => {
    if (!form.department) return;
    let cancelled = false;

    Promise.all([
      fetch(`/api/quick-picks?department=${encodeURIComponent(form.department)}`).then((r) => r.ok ? r.json() : []),
      fetch(`/api/saved-items?department=${encodeURIComponent(form.department)}`).then((r) => r.ok ? r.json() : []),
      fetch(`/api/user-quick-picks?department=${encodeURIComponent(form.department)}`).then((r) => r.ok ? r.json() : []),
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

  // ---- Keyboard shortcut: Ctrl/Cmd+Enter → Generate PDF ----
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

  // ---- Margin handler ----
  function handleApplyMargin() {
    const pct = parseFloat(marginPercent);
    if (isNaN(pct) || pct <= 0) {
      toast.error("Enter a valid margin percentage");
      return;
    }
    const multiplier = 1 + pct / 100;
    form.items.forEach((item, index) => {
      if (item.unitPrice > 0 && !item.description.includes("Tax")) {
        const newPrice = Math.round(item.unitPrice * multiplier * 100) / 100;
        const newExt = Math.round(newPrice * item.quantity * 100) / 100;
        updateItem(index, { unitPrice: newPrice, extendedPrice: newExt });
      }
    });
    toast.success(`${pct}% margin applied to all items`);
    setMarginPercent("");
  }

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
    if (userPickDescriptions.has(description)) {
      const pick = userPicks.find((p) => p.description === description && p.department === department);
      if (pick) {
        await fetch(`/api/user-quick-picks?id=${pick.id}`, { method: "DELETE" });
        setUserPicks((prev) => prev.filter((p) => p.id !== pick.id));
        setUserPickDescriptions((prev) => { const next = new Set(prev); next.delete(description); return next; });
        toast.success("Removed from quick picks");
      }
    } else {
      const res = await fetch("/api/user-quick-picks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description, unitPrice, department }),
      });
      if (res.ok) {
        const newPick = await res.json();
        setUserPicks((prev) => [...prev, newPick]);
        setUserPickDescriptions((prev) => new Set(prev).add(description));
        toast.success("Added to quick picks");
      }
    }
  }

  // ---- Signature handler ----
  function handleSignatureSelect(
    line: "line1" | "line2" | "line3",
    item: ComboboxItem
  ) {
    const found = staff.find((s) => s.id === item.id);
    if (!found) return;
    updateField("signatureStaffIds", {
      ...form.signatureStaffIds,
      [line]: found.id,
    });
    updateField("signatures", {
      ...form.signatures,
      [line]: `${found.name}, ${found.title}`,
    });
  }

  // ---- Staff combobox items ----
  const staffItems: ComboboxItem[] = staff.map((s) => ({
    id: s.id,
    label: s.name,
    sublabel: s.department,
    searchValue: `${s.name} ${s.department} ${s.title}`,
  }));

  // ---- Account number combobox items ----
  const accountNumberItems: ComboboxItem[] = staffAccountNumbers.map((an) => ({
    id: an.id,
    label: an.accountCode,
    sublabel: an.description,
  }));

  // ---- Category combobox items ----
  const categoryItems: ComboboxItem[] = categories
    .filter((c) => c.active)
    .map((c) => ({
      id: c.name,
      label: c.label,
      searchValue: `${c.name} ${c.label}`,
    }));

  // ---- Signature combobox items ----
  const signatureItems: ComboboxItem[] = staff.map((s) => ({
    id: s.id,
    label: s.name,
    sublabel: s.title,
    searchValue: `${s.name} ${s.title} ${s.department}`,
  }));

  // ---- Staff select handler ----
  function handleStaffComboboxSelect(item: ComboboxItem) {
    const found = staff.find((s) => s.id === item.id);
    if (!found) return;
    handleStaffSelect(found);
  }

  // ---- Account number select handler ----
  function handleAccountNumberSelect(item: ComboboxItem) {
    if (item.isCustom) {
      // Extract the raw value from "Add new: <value>"
      const raw = item.label.replace(/^Add new:\s*/, "");
      setPendingAccountCode(raw);
      setNewAccountDescription("");
      setShowAccountDescInput(true);
      updateField("accountNumber", raw);
    } else {
      updateField("accountNumber", item.label);
      setShowAccountDescInput(false);
    }
  }

  // ---- Save new account number ----
  async function handleSaveNewAccountNumber() {
    if (!form.staffId || !pendingAccountCode) return;
    try {
      const res = await fetch(
        `/api/staff/${form.staffId}/account-numbers`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accountCode: pendingAccountCode,
            description: newAccountDescription,
          }),
        }
      );
      if (!res.ok) throw new Error("Failed to save");
      toast.success("Account number saved");
      setShowAccountDescInput(false);
      setPendingAccountCode("");
      setNewAccountDescription("");
    } catch {
      toast.error("Failed to save account number");
    }
  }

  // ---- Category select handler ----
  function handleCategorySelect(item: ComboboxItem) {
    updateField("category", item.id);
  }

  // ---- Staff summary inline editing ----
  function handleSummaryClick(
    field: "department" | "contactExtension" | "contactEmail" | "contactPhone"
  ) {
    setEditingField(field);
  }

  function handleSummaryBlur() {
    setEditingField(null);
  }

  function handleSummaryKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === "Escape") {
      setEditingField(null);
    }
  }


  // Find the selected category label for display
  const selectedCategory = categories.find((c) => c.name === form.category);

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
            placeholder="Search staff..."
            loading={staffLoading}
          />
        </div>

        {/* Auto-filled summary row */}
        {form.staffId && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground px-1">
            {editingField === "department" ? (
              <Input
                className="h-6 w-40 text-sm"
                value={form.department}
                onChange={(e) => updateField("department", e.target.value)}
                onBlur={handleSummaryBlur}
                onKeyDown={handleSummaryKeyDown}
                tabIndex={-1}
                autoFocus
              />
            ) : (
              <span
                className="auto-filled-summary"
                tabIndex={-1}
                onClick={() => handleSummaryClick("department")}
                role="button"
              >
                {form.department || "Department"}
              </span>
            )}
            <span aria-hidden="true">&middot;</span>

            {editingField === "contactExtension" ? (
              <Input
                className="h-6 w-24 text-sm"
                value={form.contactExtension}
                onChange={(e) =>
                  updateField("contactExtension", e.target.value)
                }
                onBlur={handleSummaryBlur}
                onKeyDown={handleSummaryKeyDown}
                tabIndex={-1}
                autoFocus
              />
            ) : (
              <span
                className="auto-filled-summary"
                tabIndex={-1}
                onClick={() => handleSummaryClick("contactExtension")}
                role="button"
              >
                ext. {form.contactExtension || "—"}
              </span>
            )}
            <span aria-hidden="true">&middot;</span>

            {editingField === "contactEmail" ? (
              <Input
                className="h-6 w-48 text-sm"
                type="email"
                value={form.contactEmail}
                onChange={(e) => updateField("contactEmail", e.target.value)}
                onBlur={handleSummaryBlur}
                onKeyDown={handleSummaryKeyDown}
                tabIndex={-1}
                autoFocus
              />
            ) : (
              <span
                className="auto-filled-summary"
                tabIndex={-1}
                onClick={() => handleSummaryClick("contactEmail")}
                role="button"
              >
                {form.contactEmail || "email"}
              </span>
            )}
            <span aria-hidden="true">&middot;</span>

            {editingField === "contactPhone" ? (
              <Input
                className="h-6 w-36 text-sm"
                type="tel"
                value={form.contactPhone}
                onChange={(e) => updateField("contactPhone", e.target.value)}
                onBlur={handleSummaryBlur}
                onKeyDown={handleSummaryKeyDown}
                tabIndex={-1}
                autoFocus
              />
            ) : (
              <span
                className="auto-filled-summary"
                tabIndex={-1}
                onClick={() => handleSummaryClick("contactPhone")}
                role="button"
              >
                {form.contactPhone || "phone"}
              </span>
            )}
          </div>
        )}
      </div>

      {/* ============ INVOICE ============ */}
      <SectionDivider label="INVOICE" />

      <div className="space-y-3">
        {/* Account Number */}
        <div className="space-y-1">
          <label className="text-sm font-medium">Account Number</label>
          <InlineCombobox
            items={accountNumberItems}
            value={form.accountNumber}
            displayValue={form.accountNumber}
            onSelect={handleAccountNumberSelect}
            placeholder="Search or add account number..."
            allowCustom
            customPrefix="Add new:"
          />
          {showAccountDescInput && (
            <div className="flex items-center gap-2 mt-1">
              <Input
                className="h-7 flex-1 text-sm"
                value={newAccountDescription}
                onChange={(e) => setNewAccountDescription(e.target.value)}
                placeholder="Description for this account number..."
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSaveNewAccountNumber();
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={handleSaveNewAccountNumber}
              >
                Save
              </Button>
            </div>
          )}
        </div>

        {/* Account Code */}
        <div className="space-y-1">
          <label className="text-sm font-medium">Account Code</label>
          <Input
            value={form.accountCode}
            onChange={(e) => updateField("accountCode", e.target.value)}
            placeholder="Account code..."
            name="accountCode"
          />
        </div>

        {/* Invoice Number */}
        <div className={cn(
          "space-y-1",
          isPendingCharge && !form.invoiceNumber &&
            "rounded-lg border-l-4 border-l-primary bg-primary/5 p-2 -ml-2"
        )}>
          <label className="text-sm font-medium">
            Invoice Number <span className="text-destructive">*</span>
          </label>
          <Input
            ref={invoiceNumberRef}
            value={form.invoiceNumber}
            onChange={(e) => updateField("invoiceNumber", e.target.value)}
            placeholder="AG-XXXXXX (leave blank if not yet charged)"
            name="invoiceNumber"
          />
        </div>

        {/* Date */}
        <div className="space-y-1">
          <label className="text-sm font-medium">Date</label>
          <Input
            type="date"
            value={form.date}
            onChange={(e) => updateField("date", e.target.value)}
            name="date"
          />
        </div>

        {/* Category */}
        <div className="space-y-1">
          <label className="text-sm font-medium">
            Category <span className="text-destructive">*</span>
          </label>
          <InlineCombobox
            items={categoryItems}
            value={form.category}
            displayValue={selectedCategory?.label ?? ""}
            onSelect={handleCategorySelect}
            placeholder="Search categories..."
            loading={categoriesLoading}
          />
        </div>

        {/* Semester / Year / Dept */}
        <div className="space-y-1">
          <label className="text-sm font-medium">
            Semester / Year / Dept
          </label>
          <Input
            value={form.semesterYearDept}
            onChange={(e) =>
              updateField("semesterYearDept", e.target.value)
            }
            placeholder="e.g. Fall 2025 - Math..."
            name="semesterYearDept"
          />
        </div>
      </div>

      {/* Running Invoice Toggle */}
      <div className="flex items-center gap-3 pt-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.isRunning}
            onChange={(e) => updateField("isRunning", e.target.checked)}
            className="rounded border-border"
          />
          <span className="text-sm font-medium">Running Invoice</span>
        </label>
        {form.isRunning && (
          <Input
            value={form.runningTitle}
            onChange={(e) => updateField("runningTitle", e.target.value)}
            placeholder="Title (e.g. Music Dept Fall 2026 Supplies)"
            className="flex-1"
          />
        )}
      </div>

      {/* ============ LINE ITEMS ============ */}
      <SectionDivider label="LINE ITEMS" />

      <div className="space-y-3">
        <div className="flex items-center gap-2 mt-2 mb-3">
          <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">Margin %</span>
          <Input
            type="number"
            min={0}
            step={0.1}
            value={marginPercent}
            onChange={(e) => setMarginPercent(e.target.value)}
            placeholder="e.g. 15"
            className="w-24 h-8 text-sm"
            tabIndex={-1}
          />
          <Button type="button" variant="outline" size="xs" tabIndex={-1} onClick={handleApplyMargin}>
            Apply
          </Button>
        </div>

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
            placeholder="Additional notes or comments..."
            name="notes"
            rows={3}
          />
        </div>
      </div>

      {/* ============ SIGNATURES ============ */}
      <SectionDivider label="SIGNATURES" />

      <div className="space-y-3">
        {(["line1", "line2", "line3"] as const).map((line, idx) => (
          <div key={line} className="space-y-1">
            <label className="text-sm font-medium">
              Signature {idx + 1}
            </label>
            <InlineCombobox
              items={signatureItems}
              value={form.signatureStaffIds[line]}
              displayValue={form.signatures[line]}
              onSelect={(item) => handleSignatureSelect(line, item)}
              placeholder={`Signature line ${idx + 1}...`}
              loading={staffLoading}
            />
          </div>
        ))}
      </div>

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
          {!form.isRunning && (
            <Button variant="secondary" tabIndex={-1} onClick={savePendingCharge} disabled={saving}>
              Charge at Register
            </Button>
          )}
          {form.isRunning ? (
            <Button onClick={saveDraft} disabled={saving}>
              Save Running Invoice
            </Button>
          ) : (
            <Button onClick={handleGenerate} disabled={saving}>
              Generate PDF {isMac ? "\u2318\u21B5" : "Ctrl\u21B5"}
            </Button>
          )}
        </div>
      </div>

      <PdfProgress step={generationStep} />
    </div>
  );
}
