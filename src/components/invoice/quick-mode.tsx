"use client";

import { useState, useEffect } from "react";
import { PencilIcon, RefreshCwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { StaffSelect } from "./staff-select";
import { StaffSignatureSelect } from "./staff-signature-select";
import { LineItems } from "./line-items";
import { QuickPickPanel } from "./quick-pick-panel";
import { PrismcoreUpload } from "./prismcore-upload";
import { AccountSelect } from "./account-select";
import { StaffForm } from "@/components/staff/staff-form";
import { FieldHint, useHintsDismissed } from "./field-hint";
import type { InvoiceFormData, InvoiceItem, StaffAccountNumber, GenerationStep } from "./invoice-form";
import { PdfProgress } from "./pdf-progress";

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
}

interface QuickModeProps {
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
  saving: boolean;
  generationStep: GenerationStep;
}

export function QuickMode({
  form,
  updateField,
  updateItem,
  addItem,
  removeItem,
  total,
  handleStaffSelect,
  handleStaffEdit,
  staffAccountNumbers,
  saveDraft,
  saveAndFinalize,
  saving,
  generationStep,
}: QuickModeProps) {
  const [categories, setCategories] = useState<{ name: string; label: string }[]>([]);
  const { dismissed: hintsDismissed, dismiss: dismissHints } = useHintsDismissed();

  useEffect(() => {
    fetch("/api/categories")
      .then((res) => res.json())
      .then((data) => setCategories(data))
      .catch(() => {});
  }, []);

  const currentStaff: StaffMember | undefined = form.staffId
    ? {
        id: form.staffId,
        name: form.contactName,
        title: "",
        department: form.department,
        accountCode: form.accountCode,
        extension: form.contactExtension,
        email: form.contactEmail,
        phone: form.contactPhone,
        approvalChain: form.approvalChain,
      }
    : undefined;

  async function handleInlineStaffSave() {
    if (!form.staffId) return;
    try {
      const res = await fetch(`/api/staff/${form.staffId}`);
      if (res.ok) {
        const updated: StaffMember = await res.json();
        handleStaffEdit(updated);
      }
    } catch {
      // ignore
    }
  }

  function handleQuickPick(description: string, unitPrice: number) {
    const emptyIdx = form.items.findIndex(
      (item) => !item.description && item.unitPrice === 0
    );
    if (emptyIdx !== -1) {
      updateItem(emptyIdx, { description, unitPrice });
    } else {
      addItem();
      setTimeout(() => {
        updateItem(form.items.length, { description, unitPrice });
      }, 0);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left card: Staff & Info */}
      <Card>
        <CardHeader>
          <CardTitle>Staff &amp; Info</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label>Staff Member</Label>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <StaffSelect
                  selectedId={form.staffId}
                  onSelect={handleStaffSelect}
                />
              </div>
              {currentStaff && (
                <StaffForm
                  staff={currentStaff}
                  onSave={handleInlineStaffSave}
                  trigger={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      title="Edit staff member"
                    >
                      <PencilIcon className="size-4" />
                      <span className="sr-only">Edit staff member</span>
                    </Button>
                  }
                />
              )}
            </div>
            <FieldHint
              text="Selecting a staff member auto-fills department, contact info, and recent account numbers."
              dismissed={hintsDismissed}
              onDismiss={dismissHints}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Department</Label>
              <Input
                value={form.department}
                onChange={(e) => updateField("department", e.target.value)}
                placeholder="Department"
              />
            </div>
            <div className="space-y-1">
              <AccountSelect
                value={form.accountNumber}
                onChange={(v) => updateField("accountNumber", v)}
                staffId={form.staffId}
                accountNumbers={staffAccountNumbers}
              />
              <FieldHint
                text="Saved per person. Click a chip to reuse, or type a new one and save it."
                dismissed={hintsDismissed}
                onDismiss={dismissHints}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Account Code</Label>
            <Input
              value={form.accountCode}
              onChange={(e) => updateField("accountCode", e.target.value)}
              placeholder="Account code"
            />
            <FieldHint
              text="Classification code for this transaction."
              dismissed={hintsDismissed}
              onDismiss={dismissHints}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Extension</Label>
              <Input
                value={form.contactExtension}
                onChange={(e) =>
                  updateField("contactExtension", e.target.value)
                }
                placeholder="Extension"
              />
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <Input
                value={form.contactEmail}
                onChange={(e) => updateField("contactEmail", e.target.value)}
                placeholder="Email"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Invoice Number</Label>
              <Input
                value={form.invoiceNumber}
                onChange={(e) => updateField("invoiceNumber", e.target.value)}
                placeholder="INV-0001"
              />
              <FieldHint
                text="Must be unique (e.g., AG-000111222)."
                dismissed={hintsDismissed}
                onDismiss={dismissHints}
              />
            </div>
            <div className="space-y-1">
              <Label>Date</Label>
              <Input
                type="date"
                value={form.date}
                onChange={(e) => updateField("date", e.target.value)}
              />
              <FieldHint
                text="Invoice date."
                dismissed={hintsDismissed}
                onDismiss={dismissHints}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Category</Label>
            <Select
              value={form.category || null}
              onValueChange={(value) => updateField("category", value ?? "")}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.name} value={cat.name}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldHint
              text="Required — drives analytics and reporting."
              dismissed={hintsDismissed}
              onDismiss={dismissHints}
            />
          </div>

          <div className="space-y-1">
            <Label>Semester / Year / Dept</Label>
            <Input
              value={form.semesterYearDept}
              onChange={(e) => updateField("semesterYearDept", e.target.value)}
              placeholder="e.g. Fall 2025 \u2013 Math"
            />
            <FieldHint
              text="e.g., Fall 2026 Student Services."
              dismissed={hintsDismissed}
              onDismiss={dismissHints}
            />
          </div>

          {/* Signatures */}
          <div className="space-y-3 pt-2">
            <p className="text-sm font-semibold">Signatures</p>
            <FieldHint
              text="Select approvers — they'll be remembered for this staff member next time."
              dismissed={hintsDismissed}
              onDismiss={dismissHints}
            />
            <div className="space-y-2">
              {(["line1", "line2", "line3"] as const).map((line, idx) => (
                <div key={line} className="space-y-1">
                  <Label>Signature {idx + 1}</Label>
                  <StaffSignatureSelect
                    selectedId={form.signatureStaffIds[line]}
                    displayValue={form.signatures[line]}
                    onSelect={(staff) => {
                      const title = staff.title ? `, ${staff.title}` : "";
                      const display = `${staff.name}${title}`;
                      updateField("signatures", {
                        ...form.signatures,
                        [line]: display,
                      });
                      updateField("signatureStaffIds", {
                        ...form.signatureStaffIds,
                        [line]: staff.id,
                      });
                    }}
                    placeholder={`Signature line ${idx + 1}`}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* PrismCore upload */}
          <div className="space-y-1">
            <PrismcoreUpload
              value={form.prismcorePath}
              onChange={(path) => updateField("prismcorePath", path)}
            />
            <FieldHint
              text="Attach a PrismCore POS receipt to merge into the final PDF."
              dismissed={hintsDismissed}
              onDismiss={dismissHints}
            />
          </div>
        </CardContent>
      </Card>

      {/* Right card: Line Items */}
      <Card>
        <CardHeader>
          <CardTitle>Line Items</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <QuickPickPanel
              department={form.department}
              onSelect={handleQuickPick}
            />
            <FieldHint
              text="Add items manually or click Quick Picks below. Click the bookmark icon to save an item for reuse."
              dismissed={hintsDismissed}
              onDismiss={dismissHints}
            />
          </div>
          <LineItems
            items={form.items}
            onUpdate={updateItem}
            onAdd={addItem}
            onRemove={removeItem}
            total={total}
            department={form.department}
          />
          <div className="space-y-1">
            <Label>Comments / Notes</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => updateField("notes", e.target.value)}
              placeholder="Additional notes or comments\u2026"
              rows={3}
            />
          </div>

          {/* Recurring Invoice */}
          <div className="space-y-3 border rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RefreshCwIcon className="size-4 text-muted-foreground" />
                <p className="text-sm font-semibold">Recurring Invoice</p>
              </div>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="size-4 rounded"
                  checked={form.isRecurring}
                  onChange={(e) => updateField("isRecurring", e.target.checked)}
                />
                <span className="text-sm">Make this invoice recurring</span>
              </label>
            </div>
            {form.isRecurring && (
              <div className="space-y-3 pt-1">
                <div className="space-y-1">
                  <Label>Interval</Label>
                  <Select
                    value={form.recurringInterval || null}
                    onValueChange={(v) => updateField("recurringInterval", (v ?? "") as string)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select interval" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                      <SelectItem value="yearly">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Email invoice to</Label>
                  <Input
                    type="email"
                    value={form.recurringEmail}
                    onChange={(e) => updateField("recurringEmail", e.target.value)}
                    placeholder="recipient@example.com"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={saveDraft} disabled={saving}>
              Save Draft
            </Button>
            <Button onClick={saveAndFinalize} disabled={saving}>
              Generate Invoice PDF
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* eslint-disable-next-line react/jsx-no-undef */}
      <PdfProgress step={generationStep} />
    </div>
  );
}
