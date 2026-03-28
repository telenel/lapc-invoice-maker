"use client";

import { useState, useEffect } from "react";
import { ChevronDownIcon, ChevronRightIcon, InfoIcon } from "lucide-react";
import { toast } from "sonner";
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
import { cn } from "@/lib/utils";
import { categoryApi } from "@/domains/category/api-client";
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
  staffAccountNumbers: StaffAccountNumber[];
  saveQuote: () => Promise<void>;
  saving: boolean;
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

export function QuoteMode({
  form,
  updateField,
  updateItem,
  addItem,
  removeItem,
  total,
  itemsWithMargin,
  handleStaffSelect,
  staffAccountNumbers,
  saveQuote,
  saving,
}: QuoteModeProps) {
  // ---- Local state ----
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [quickPicksOpen, setQuickPicksOpen] = useState(false);

  // ---- Tax calculation ----
  const taxItems = form.marginEnabled ? itemsWithMargin : form.items;
  const { subtotal, taxAmount, total: grandTotal } = useTaxCalculation(
    taxItems,
    form.taxEnabled,
    TAX_RATE
  );

  // Inline editing for staff summary fields
  const [editingField, setEditingField] = useState<
    "department" | "contactExtension" | "contactEmail" | "contactPhone" | null
  >(null);

  // ---- Data fetching ----
  useEffect(() => {
    categoryApi.list()
      .then((data) => setCategories(data))
      .catch(() => {})
      .finally(() => setCategoriesLoading(false));
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
  function handleSave() {
    if (!form.staffId) {
      toast.error("Please select a staff member");
      return;
    }
    if (!form.recipientName.trim()) {
      toast.error("Please enter a recipient name");
      return;
    }
    saveQuote();
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
      {/* ============ RECIPIENT ============ */}
      <Card>
        <CardHeader>
          <CardTitle>Recipient</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="recipientName">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="recipientName"
              value={form.recipientName}
              onChange={(e) => updateField("recipientName", e.target.value)}
              placeholder="Contact name..."
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
                placeholder="Company or organization..."
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
              value={form.date}
              onChange={(e) => updateField("date", e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="expirationDate">Expiration Date</Label>
            <Input
              id="expirationDate"
              type="date"
              value={form.expirationDate}
              onChange={(e) => updateField("expirationDate", e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label>Category</Label>
          {categoriesLoading ? (
            <Input disabled placeholder="Loading categories..." />
          ) : (
            <Select
              value={form.category || null}
              onValueChange={(value) => updateField("category", value ?? "")}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select category..." />
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
            placeholder="Additional notes or comments..."
            rows={3}
          />
        </div>
      </div>

      {/* ============ STAFF & ACCOUNT ============ */}
      <SectionDivider label="STAFF & ACCOUNT" />

      <div className="space-y-3">
        <div className="space-y-1">
          <Label>Staff Member</Label>
          <StaffSelect
            selectedId={form.staffId}
            onSelect={handleStaffSelect}
            placeholder="Select staff member..."
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
                className="cursor-pointer hover:text-foreground transition-colors"
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

        {/* Account Number */}
        {form.staffId && (
          <AccountSelect
            value={form.accountNumber}
            onChange={(value) => updateField("accountNumber", value)}
            staffId={form.staffId}
            accountNumbers={staffAccountNumbers}
          />
        )}

        {/* Account Code */}
        {form.staffId && (
          <div className="space-y-1">
            <Label htmlFor="accountCode">Account Code</Label>
            <Input
              id="accountCode"
              value={form.accountCode}
              onChange={(e) => updateField("accountCode", e.target.value)}
              placeholder="Account code..."
            />
          </div>
        )}
      </div>

      {/* ============ CATERING ============ */}
      <SectionDivider label="CATERING" />

      <div className="space-y-3">
        <div className="flex items-center gap-2">
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
          />
        )}
      </div>

      {/* ============ MARGIN & TAX ============ */}
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

      <div className="space-y-3">
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

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving} size="lg">
            {saving ? "Saving..." : "Save Quote"}
          </Button>
        </div>
      </div>
    </div>
  );
}
