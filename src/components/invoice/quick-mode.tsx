"use client";

import { PencilIcon } from "lucide-react";
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
  const { dismissed: hintsDismissed, dismiss: dismissHints } = useHintsDismissed();

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
              text="Select a staff member to auto-fill department, contact info, and account numbers."
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
                text="Saved account numbers appear as chips. New ones can be saved for next time."
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
            </div>
            <div className="space-y-1">
              <Label>Date</Label>
              <Input
                type="date"
                value={form.date}
                onChange={(e) => updateField("date", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Category</Label>
            <Select
              value={form.category}
              onValueChange={(value) => updateField("category", value ?? "")}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="COPY_TECH">CopyTech</SelectItem>
                <SelectItem value="CATERING">Catering</SelectItem>
                <SelectItem value="SUPPLIES">Supplies</SelectItem>
                <SelectItem value="DEPARTMENT_PURCHASE">Department Purchase</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>Semester / Year / Dept</Label>
            <Input
              value={form.semesterYearDept}
              onChange={(e) => updateField("semesterYearDept", e.target.value)}
              placeholder="e.g. Fall 2025 \u2013 Math"
            />
          </div>

          {/* Signatures */}
          <div className="space-y-3 pt-2">
            <p className="text-sm font-semibold">Signatures</p>
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
          <PrismcoreUpload
            value={form.prismcorePath}
            onChange={(path) => updateField("prismcorePath", path)}
          />
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
            {form.department && (
              <FieldHint
                text="Click an item to add it to your invoice."
                dismissed={hintsDismissed}
                onDismiss={dismissHints}
              />
            )}
          </div>
          <LineItems
            items={form.items}
            onUpdate={updateItem}
            onAdd={addItem}
            onRemove={removeItem}
            total={total}
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
