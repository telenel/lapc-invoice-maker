"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { ChevronDownIcon, ChevronRightIcon, InfoIcon } from "lucide-react";
import { toast } from "sonner";
import { useAutoSave, loadDraft } from "@/lib/use-auto-save";
import { DraftRecoveryBanner } from "@/components/ui/draft-recovery-banner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StaffSelect } from "@/components/invoice/staff-select";
import { AccountSelect } from "@/components/invoice/account-select";
import { LineItems } from "@/components/invoice/line-items";
import { QuickPickPanel } from "@/components/invoice/quick-pick-panel";
import { CateringDetailsCard } from "@/components/quote/catering-details-card";
import { useTaxCalculation } from "@/components/invoice/hooks/use-tax-calculation";
import { TAX_RATE } from "@/domains/invoice/constants";
import { FormError } from "@/components/ui/form-error";
import { cn } from "@/lib/utils";
import { categoryApi } from "@/domains/category/api-client";
import { templateApi } from "@/domains/template/api-client";
import type { TemplateResponse } from "@/domains/template/types";
import type {
  QuoteFormData,
  QuoteItem,
  StaffAccountNumber,
  StaffMember,
} from "@/components/quote/quote-form";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Category {
  id: string;
  name: string;
  label: string;
  active: boolean;
}

interface QuoteModeProps {
  form: QuoteFormData;
  updateField: <K extends keyof QuoteFormData>(
    key: K,
    value: QuoteFormData[K]
  ) => void;
  updateItem: (index: number, patch: Partial<QuoteItem>) => void;
  addItem: () => void;
  removeItem: (index: number) => void;
  total: number;
  itemsWithMargin: QuoteItem[];
  handleStaffSelect: (staff: StaffMember) => void;
  clearStaffSelection: () => void;
  staffAccountNumbers: StaffAccountNumber[];
  saveQuote: () => Promise<void>;
  saving: boolean;
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
    <div className="flex flex-wrap items-center gap-3 pt-6 pb-2">
      <span className="section-label">{label}</span>
      <div className="flex-1 border-t border-border" />
      {children}
    </div>
  );
}

export function QuoteMode({
  form,
  updateField,
  updateItem,
  addItem,
  removeItem,
  total,
  itemsWithMargin,
  handleStaffSelect,
  clearStaffSelection,
  staffAccountNumbers,
  saveQuote,
  saving,
  existingId,
}: QuoteModeProps) {
  // ---- Session ----
  const { data: session } = useSession();
  const userId = (session?.user as { id?: string } | undefined)?.id ?? null;

  // ---- Local state ----
  const [categories, setCategories] = useState<Category[]>([]);
  const [templates, setTemplates] = useState<TemplateResponse[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [quickPicksOpen, setQuickPicksOpen] = useState(false);
  const [cateringOverride, setCateringOverride] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // ---- Auto-save + draft recovery ----
  const routeKey = existingId ? `/quotes/${existingId}/edit` : "/quotes/new";
  const { clearDraft } = useAutoSave(form, routeKey, userId);
  const [draftEntry, setDraftEntry] = useState(() => {
    if (typeof window === "undefined" || !userId) return null;
    return loadDraft<QuoteFormData>(routeKey, userId);
  });

  // Reload draft when userId resolves from null to the real user id
  useEffect(() => {
    if (typeof window === "undefined" || !userId) return;
    const entry = loadDraft<QuoteFormData>(routeKey, userId);
    setDraftEntry(entry);
  }, [userId, routeKey]);

  // ---- Save wrapper that clears the draft on success ----
  const handleSaveQuote = useCallback(async () => {
    await saveQuote();
    clearDraft();
  }, [saveQuote, clearDraft]);

  // ---- Tax calculation ----
  const taxItems = form.marginEnabled ? itemsWithMargin : form.items;
  const { subtotal, taxAmount, total: grandTotal } = useTaxCalculation(
    taxItems,
    form.taxEnabled,
    TAX_RATE
  );

  // Inline editing for staff summary fields
  const [editingField, setEditingField] = useState<
    "contactExtension" | "contactEmail" | "contactPhone" | null
  >(null);

  // ---- Data fetching ----
  useEffect(() => {
    let cancelled = false;

    categoryApi.list()
      .catch(() => [] as Category[])
      .then((categoryData) => {
        if (!cancelled) {
          setCategories(categoryData);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setCategoriesLoading(false);
        }
      });

    templateApi.list("QUOTE")
      .catch(() => [] as TemplateResponse[])
      .then((templateData) => {
        if (!cancelled) {
          setTemplates(templateData);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

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

  // ---- Validation + save ----
  const validateQuoteForm = useCallback(() => {
    const errors: Record<string, string> = {};
    if (!form.recipientName.trim()) errors.recipientName = "Please enter a recipient name";
    if (!form.department.trim()) errors.department = "Please enter a department";
    const hasValidItem = form.items.some(
      (item: { description: string }) => item.description.trim() !== ""
    );
    if (!hasValidItem) errors.lineItems = "At least one line item with a description is required";
    if (form.isCateringEvent) {
      if (!form.cateringDetails.location?.trim())
        errors["cateringDetails.location"] = "Event location is required";
      if (!form.cateringDetails.contactName?.trim())
        errors["cateringDetails.contactName"] = "Event contact name is required";
      if (!form.cateringDetails.contactPhone?.trim())
        errors["cateringDetails.contactPhone"] = "Event contact phone is required";
    }
    return errors;
  }, [form]);

  function handleSave() {
    const errors = validateQuoteForm();
    setValidationErrors(errors);
    if (Object.keys(errors).length > 0) {
      toast.error(
        `${Object.keys(errors).length} issue(s) to resolve before saving`
      );
      const firstKey = Object.keys(errors)[0];
      document
        .getElementById(`field-${firstKey}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    handleSaveQuote();
  }

  // ---- Staff summary inline editing ----
  function handleSummaryClick(
    field: "contactExtension" | "contactEmail" | "contactPhone"
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


  // ---- Save as Template ----
  async function handleSaveAsTemplate() {
    const name = prompt("Template name:");
    if (!name?.trim()) return;
    try {
      await templateApi.create({
        name: name.trim(),
        type: "QUOTE",
        staffId: form.staffId || undefined,
        department: form.department,
        category: form.category,
        accountCode: form.accountCode || undefined,
        marginEnabled: form.marginEnabled,
        marginPercent: form.marginPercent !== undefined ? Number(form.marginPercent) : undefined,
        taxEnabled: form.taxEnabled,
        notes: form.notes || undefined,
        isCateringEvent: form.isCateringEvent,
        cateringDetails: form.isCateringEvent ? form.cateringDetails : undefined,
        items: form.items.filter((i) => i.description.trim()).map((item, idx) => ({
          description: item.description,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
          sortOrder: idx,
          isTaxable: item.isTaxable,
          costPrice: item.costPrice !== undefined ? Number(item.costPrice) : undefined,
          marginOverride: item.marginOverride !== undefined ? Number(item.marginOverride) : undefined,
        })),
      });
      toast.success(`Template "${name.trim()}" saved`);
      templateApi.list("QUOTE").then((data) => setTemplates(data)).catch(() => {});
    } catch {
      toast.error("Failed to save template");
    }
  }

  // ---- Catering toggle ----
  function handleCateringToggle(checked: boolean) {
    updateField("isCateringEvent", checked);
    if (checked && !form.cateringDetails.contactName && form.recipientName) {
      updateField("cateringDetails", {
        ...form.cateringDetails,
        contactName: form.recipientName,
        contactEmail: form.recipientEmail,
        eventDate: form.date,
      });
    }
    if (checked && !form.taxEnabled) {
      updateField("taxEnabled", true);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-2">
      {draftEntry && (
        <DraftRecoveryBanner
          savedAt={draftEntry.savedAt}
          onResume={() => {
            const draft = draftEntry.data;
            (Object.keys(draft) as (keyof QuoteFormData)[]).forEach((key) => {
              updateField(key, draft[key] as QuoteFormData[typeof key]);
            });
            setDraftEntry(null);
          }}
          onDiscard={() => {
            clearDraft();
            setDraftEntry(null);
          }}
        />
      )}

      {templates.length > 0 && (
        <div className="mb-4">
          <select
            className="rounded-md border border-input bg-background px-3 py-2 text-sm w-full"
            defaultValue=""
            onChange={(e) => {
              const t = templates.find((tmpl) => tmpl.id === e.target.value);
              if (!t) return;
              updateField("staffId", t.staffId ?? "");
              updateField("department", t.department ?? "");
              updateField("category", t.category ?? "");
              updateField("accountCode", t.accountCode ?? "");
              updateField("marginEnabled", t.marginEnabled);
              updateField("marginPercent", t.marginPercent ?? 0);
              updateField("taxEnabled", t.taxEnabled);
              updateField("notes", t.notes ?? "");
              updateField("isCateringEvent", t.isCateringEvent);
              if (t.cateringDetails) {
                updateField("cateringDetails", t.cateringDetails as QuoteFormData["cateringDetails"]);
              }
              const newItems = t.items.map((item, idx) => ({
                _key: crypto.randomUUID(),
                description: item.description,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                isTaxable: item.isTaxable,
                extendedPrice: item.quantity * item.unitPrice,
                sortOrder: idx,
                marginOverride: item.marginOverride,
                costPrice: item.costPrice,
              }));
              updateField("items", newItems);
              toast.success(`Loaded template "${t.name}"`);
              e.target.value = "";
            }}
          >
            <option value="">Load from template...</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* ============ RECIPIENT ============ */}
      <Card>
        <CardHeader>
          <CardTitle>Recipient</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label>Pierce Staff Recipient</Label>
              {form.staffId && (
                <button
                  type="button"
                  onClick={clearStaffSelection}
                  className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  Use external recipient instead
                </button>
              )}
            </div>
            <StaffSelect
              selectedId={form.staffId}
              onSelect={handleStaffSelect}
              placeholder="Select staff recipient (optional)…"
            />
            <p className="text-xs text-muted-foreground">
              Choose a Pierce staff member to autofill recipient, department, and account details. Leave blank for outside vendors.
            </p>
          </div>

          <div id="field-recipientName" className="space-y-1">
            <Label htmlFor="recipientName">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="recipientName"
              value={form.recipientName}
              onChange={(e) => {
                updateField("recipientName", e.target.value);
                setValidationErrors((prev) => {
                  const next = { ...prev };
                  delete next.recipientName;
                  return next;
                });
              }}
              placeholder="Contact name…"
              aria-invalid={!!validationErrors.recipientName}
            />
            <FormError message={validationErrors.recipientName} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="recipientEmail">Email</Label>
              <Input
                id="recipientEmail"
                type="email"
                value={form.recipientEmail}
                onChange={(e) => updateField("recipientEmail", e.target.value)}
                placeholder="email@example.com"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="recipientOrg">Organization</Label>
              <Input
                id="recipientOrg"
                value={form.recipientOrg}
                onChange={(e) => updateField("recipientOrg", e.target.value)}
                placeholder="Company or organization…"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ============ QUOTE DETAILS ============ */}
      <SectionDivider label="QUOTE DETAILS" />

      <div className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="quoteDate">Date</Label>
            <Input
              id="quoteDate"
              type="date"
              tabIndex={-1}
              value={form.date}
              onChange={(e) => updateField("date", e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="expirationDate">Expiration Date</Label>
            <Input
              id="expirationDate"
              type="date"
              tabIndex={-1}
              value={form.expirationDate}
              onChange={(e) => updateField("expirationDate", e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label>Category</Label>
          {categoriesLoading ? (
            <Input disabled placeholder="Loading categories…" />
          ) : (
            <Select
              value={form.category || null}
              onValueChange={(value) => updateField("category", value ?? "")}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select category…" />
              </SelectTrigger>
              <SelectContent>
                {categories
                  .filter((c) => c.active)
                  .map((cat) => (
                    <SelectItem key={cat.name} value={cat.name}>
                      {cat.label}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="space-y-1">
          <Label htmlFor="quoteNotes">Notes</Label>
          <Textarea
            id="quoteNotes"
            value={form.notes}
            onChange={(e) => updateField("notes", e.target.value)}
            placeholder="Additional notes or comments…"
            rows={3}
          />
        </div>
      </div>

      {/* ============ DEPARTMENT & ACCOUNT ============ */}
      <SectionDivider label="DEPARTMENT & ACCOUNT" />

      <div className="space-y-3">
        {/* Auto-filled summary row */}
        {form.staffId && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground px-1">
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
                className="cursor-pointer hover:text-foreground transition-colors"
                tabIndex={-1}
                onClick={() => handleSummaryClick("contactExtension")}
                role="button"
              >
                ext. {form.contactExtension || "\u2014"}
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
                className="cursor-pointer hover:text-foreground transition-colors"
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
                className="cursor-pointer hover:text-foreground transition-colors"
                tabIndex={-1}
                onClick={() => handleSummaryClick("contactPhone")}
                role="button"
              >
                {form.contactPhone || "phone"}
              </span>
            )}
          </div>
        )}

        <div id="field-department" className="space-y-1">
          <Label htmlFor="quoteDepartment">
            Department <span className="text-destructive">*</span>
          </Label>
          <Input
            id="quoteDepartment"
            value={form.department}
            onChange={(e) => {
              updateField("department", e.target.value);
              setValidationErrors((prev) => {
                const next = { ...prev };
                delete next.department;
                return next;
              });
            }}
            placeholder="Department…"
            aria-invalid={!!validationErrors.department}
          />
          <FormError message={validationErrors.department} />
        </div>

        {/* Account Number */}
        {form.staffId ? (
          <AccountSelect
            value={form.accountNumber}
            onChange={(value) => updateField("accountNumber", value)}
            staffId={form.staffId}
            accountNumbers={staffAccountNumbers}
          />
        ) : (
          <div className="space-y-1">
            <Label htmlFor="accountNumber">Account Number</Label>
            <Input
              id="accountNumber"
              value={form.accountNumber}
              onChange={(e) => updateField("accountNumber", e.target.value)}
              placeholder="Account number…"
            />
          </div>
        )}

        {/* Account Code */}
        <div className="space-y-1">
          <Label htmlFor="accountCode">Account Code</Label>
          <Input
            id="accountCode"
            value={form.accountCode}
            onChange={(e) => updateField("accountCode", e.target.value)}
            placeholder="Account code…"
          />
        </div>
      </div>

      {/* ============ CATERING ============ */}
      <SectionDivider label="CATERING" />

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Checkbox
            checked={form.isCateringEvent}
            onCheckedChange={(checked) => handleCateringToggle(!!checked)}
          />
          <Label className="text-sm font-medium">This is a catering event</Label>
          <span className="text-xs text-muted-foreground">
            Adds event to calendar and enables catering guide
          </span>
        </div>

        {form.isCateringEvent && (
          <CateringDetailsCard
            details={form.cateringDetails}
            onChange={(details) => {
              updateField("cateringDetails", details);
              // Clear catering-related validation errors when details change
              setValidationErrors((prev) => {
                const next = { ...prev };
                delete next["cateringDetails.location"];
                delete next["cateringDetails.contactName"];
                delete next["cateringDetails.contactPhone"];
                return next;
              });
            }}
            overrideMode={cateringOverride}
            onOverrideChange={setCateringOverride}
            validationErrors={validationErrors}
          />
        )}
      </div>

      {/* ============ MARGIN & TAX ============ */}
      <SectionDivider label="PRICING" />

      <div className="space-y-3">
        {/* Apply Margin */}
        <div className="flex flex-wrap items-center gap-3">
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
            <PopoverContent side="bottom" align="start" className="w-[min(20rem,calc(100vw-2rem))]">
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
      <SectionDivider label="LINE ITEMS">
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setQuickPicksOpen((prev) => !prev)}
          className={cn(
            "flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          )}
        >
          {quickPicksOpen ? (
            <ChevronDownIcon className="size-3.5" />
          ) : (
            <ChevronRightIcon className="size-3.5" />
          )}
          Quick Picks
        </button>
      </SectionDivider>

      <div id="field-lineItems" className="space-y-3">
        <FormError message={validationErrors.lineItems} />
        {quickPicksOpen && (
          <QuickPickPanel
            department={form.department}
            onSelect={handleQuickPick}
            currentSubtotal={total}
          />
        )}

        <LineItems
          items={form.items}
          onUpdate={updateItem}
          onAdd={addItem}
          onRemove={removeItem}
          total={total}
          department={form.department}
          marginEnabled={form.marginEnabled}
          itemsWithMargin={itemsWithMargin}
          taxEnabled={form.taxEnabled}
          isCateringEvent={form.isCateringEvent}
        />
      </div>

      {/* ============ TOTALS + SAVE ============ */}
      <Separator className="mt-6" />

      <div className="pt-4 pb-8 space-y-3">
        <div className="space-y-1.5 text-sm tabular-nums">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span>
              ${subtotal.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </div>

          {form.marginEnabled && form.marginPercent > 0 && (
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

        {Object.keys(validationErrors).length > 0 && (
          <Card className="border-red-500/30 bg-red-50 dark:bg-red-950/20">
            <CardContent className="py-3">
              <p className="text-sm font-medium text-red-600 mb-2">
                {Object.keys(validationErrors).length} issue(s) to resolve:
              </p>
              <ul className="space-y-1">
                {Object.entries(validationErrors).map(([key, msg]) => (
                  <li key={key}>
                    <button
                      type="button"
                      className="text-sm text-red-500 underline hover:text-red-700"
                      onClick={() =>
                        document
                          .getElementById(`field-${key}`)
                          ?.scrollIntoView({ behavior: "smooth", block: "center" })
                      }
                    >
                      {msg}
                    </button>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={handleSaveAsTemplate} disabled={saving} className="w-full sm:w-auto">
            Save as Template
          </Button>
          <Button onClick={handleSave} disabled={saving} size="lg" className="w-full sm:w-auto">
            {saving ? "Saving..." : existingId ? "Update Quote" : "Save Quote"}
          </Button>
        </div>
      </div>
    </div>
  );
}
