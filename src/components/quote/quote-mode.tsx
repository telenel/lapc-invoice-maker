"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { InfoIcon } from "lucide-react";
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
import { CateringDetailsCard } from "@/components/quote/catering-details-card";
import { useTaxCalculation } from "@/components/invoice/hooks/use-tax-calculation";
import { categoryApi } from "@/domains/category/api-client";
import { templateApi } from "@/domains/template/api-client";
import type { TemplateResponse } from "@/domains/template/types";
import { sanitizeCustomerProvidedCateringDetails } from "@/domains/quote/catering";
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
  saveQuote: (overrides?: Partial<QuoteFormData>) => Promise<void>;
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
    <div className="flex flex-wrap items-center gap-3 pt-8 pb-2">
      <span className="flex items-center gap-2 text-[11px] font-semibold tracking-widest text-muted-foreground/70 uppercase">
        <span className="inline-block size-1.5 rounded-full bg-primary/40" aria-hidden="true" />
        {label}
      </span>
      <div className="flex-1 border-t border-border/60" />
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
  const [cateringOverride, setCateringOverride] = useState(false);

  // ---- Auto-save + draft recovery ----
  const routeKey = existingId ? `/quotes/${existingId}/edit` : "/quotes/new";
  const { clearDraft } = useAutoSave(form, routeKey, userId);
  const [draftEntry, setDraftEntry] = useState<{ data: QuoteFormData; savedAt: number } | null>(null);

  useEffect(() => {
    if (!userId) {
      setDraftEntry(null);
      return;
    }

    let cancelled = false;
    void loadDraft<QuoteFormData>(routeKey, userId).then((entry) => {
      if (!cancelled) {
        setDraftEntry(entry);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [userId, routeKey]);

  const getSaveOverrides = useCallback((): Partial<QuoteFormData> | undefined => {
    if (!form.isCateringEvent || cateringOverride) return undefined;
    return {
      cateringDetails: sanitizeCustomerProvidedCateringDetails(form.cateringDetails),
    };
  }, [cateringOverride, form.cateringDetails, form.isCateringEvent]);

  // ---- Save wrapper that clears the draft on success ----
  const handleSaveQuote = useCallback(async () => {
    await saveQuote(getSaveOverrides());
    clearDraft();
  }, [saveQuote, getSaveOverrides, clearDraft]);

  // ---- Tax calculation ----
  const taxItems = form.marginEnabled ? itemsWithMargin : form.items;
  const { subtotal, taxAmount, total: grandTotal } = useTaxCalculation(
    taxItems,
    form.taxEnabled,
    form.taxRate
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

  // ---- Validation + save ----
  function handleSave() {
    if (!form.recipientName.trim()) {
      toast.error("Please enter a recipient name");
      return;
    }
    if (!form.department.trim()) {
      toast.error("Please enter a department");
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
    const templateCateringDetails =
      form.isCateringEvent
        ? cateringOverride
          ? form.cateringDetails
          : sanitizeCustomerProvidedCateringDetails(form.cateringDetails)
        : undefined;
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
        taxRate: form.taxEnabled ? Number(form.taxRate) : undefined,
        notes: form.notes || undefined,
        isCateringEvent: form.isCateringEvent,
        cateringDetails: templateCateringDetails,
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
    <div className="space-y-2">
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
        <div className="mb-6 rounded-xl border border-dashed border-border bg-muted/30 p-3">
          <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Start from a template</p>
          <Select
            onValueChange={(value) => {
              const t = templates.find((tmpl) => tmpl.id === value);
              if (!t) return;
              updateField("staffId", t.staffId ?? "");
              updateField("department", t.department ?? "");
              updateField("category", t.category ?? "");
              updateField("accountCode", t.accountCode ?? "");
              updateField("marginEnabled", t.marginEnabled);
              updateField("marginPercent", t.marginPercent ?? 0);
              updateField("taxEnabled", t.taxEnabled);
              updateField("taxRate", t.taxRate ?? 0);
              updateField("notes", t.notes ?? "");
              updateField("isCateringEvent", t.isCateringEvent);
              if (t.cateringDetails) {
                updateField("cateringDetails", t.cateringDetails as QuoteFormData["cateringDetails"]);
              }
              const newItems = t.items.map((item, idx) => ({
                _key: crypto.randomUUID(),
                sku: null,
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
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Choose a template..." />
            </SelectTrigger>
            <SelectContent>
              {templates.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* ============ RECIPIENT ============ */}
      <Card>
        <CardHeader>
          <CardTitle>Recipient</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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

          <div className="space-y-1">
            <Label htmlFor="recipientName">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="recipientName"
              value={form.recipientName}
              onChange={(e) => updateField("recipientName", e.target.value)}
              placeholder="Contact name…"
            />
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

      <Card>
        <CardContent className="space-y-4 pt-5">
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
        </CardContent>
      </Card>

      {/* ============ DEPARTMENT & ACCOUNT ============ */}
      <SectionDivider label="DEPARTMENT & ACCOUNT" />

      <Card>
        <CardContent className="space-y-4 pt-5">
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

        <div className="space-y-1">
          <Label htmlFor="quoteDepartment">
            Department <span className="text-destructive">*</span>
          </Label>
          <Input
            id="quoteDepartment"
            value={form.department}
            onChange={(e) => updateField("department", e.target.value)}
            placeholder="Department…"
          />
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
        </CardContent>
      </Card>

      {/* ============ CATERING ============ */}
      <SectionDivider label="CATERING" />

      <div className="space-y-4">
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
            onChange={(details) => updateField("cateringDetails", details)}
            overrideMode={cateringOverride}
            onOverrideChange={setCateringOverride}
          />
        )}
      </div>

      {/* ============ PRICING ============ */}
      <SectionDivider label="PRICING" />

      <Card>
        <CardContent className="space-y-4 pt-5">
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
                  ({(form.taxRate * 100).toFixed(2)}%)
                </span>
              </Label>
            </div>

            {form.taxEnabled && (
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={0.01}
                  value={Number((form.taxRate * 100).toFixed(2))}
                  onChange={(e) => updateField("taxRate", Number(e.target.value || "0") / 100)}
                  className="w-24 h-7 text-sm"
                  aria-label="Sales tax percentage"
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
            )}

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

          <Separator />

          <LineItems
            items={form.items}
            onUpdate={updateItem}
            onAdd={addItem}
            onRemove={removeItem}
            total={total}
            marginEnabled={form.marginEnabled}
            itemsWithMargin={itemsWithMargin}
            taxEnabled={form.taxEnabled}
            isCateringEvent={form.isCateringEvent}
          />
        </CardContent>
      </Card>

      {/* ============ TOTALS + SAVE ============ */}
      <div className="mt-8 rounded-xl border border-border bg-muted/30 p-4 tabular-nums">
        <div className="space-y-1.5 text-sm">
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
                CA Sales Tax ({(form.taxRate * 100).toFixed(2)}% on taxable items)
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

          <div className="flex justify-between text-xl font-bold pt-1">
            <span>Total</span>
            <span>
              ${grandTotal.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 -mx-5 border-t border-border/60 bg-background/90 px-5 py-4 backdrop-blur-lg sm:relative sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-none sm:pt-4 sm:pb-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={handleSaveAsTemplate} disabled={saving} className="w-full sm:w-auto">
            Save as Template
          </Button>
          <Button onClick={handleSave} disabled={saving} size="lg" className="w-full sm:w-auto shadow-sm">
            {saving ? "Saving..." : existingId ? "Update Quote" : "Save Quote"}
          </Button>
        </div>
      </div>
    </div>
  );
}
