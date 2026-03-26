"use client";

import { useState } from "react";
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
  CardFooter,
} from "@/components/ui/card";
import { StaffSelect } from "./staff-select";
import { LineItems } from "./line-items";
import { QuickPickPanel } from "./quick-pick-panel";
import { PrismcoreUpload } from "./prismcore-upload";
import { AccountSelect } from "./account-select";
import { StaffForm } from "@/components/staff/staff-form";
import { FieldHint, useHintsDismissed } from "./field-hint";
import type { InvoiceFormData, InvoiceItem, StaffAccountNumber } from "./invoice-form";

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

interface WizardModeProps {
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
}

const STEPS = ["Staff & Info", "Line Items", "Review"] as const;

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-0 mb-6">
      {STEPS.map((label, idx) => {
        const stepNum = idx + 1;
        const isActive = stepNum === current;
        const isDone = stepNum < current;
        return (
          <div key={label} className="flex items-center">
            {idx > 0 && (
              <div
                className={`h-px w-10 ${
                  isDone ? "bg-primary" : "bg-border"
                }`}
              />
            )}
            <div className="flex flex-col items-center gap-1">
              <div
                className={`size-8 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-colors ${
                  isActive
                    ? "border-primary bg-primary text-primary-foreground"
                    : isDone
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground"
                }`}
              >
                {isDone ? "\u2713" : stepNum}
              </div>
              <span
                className={`text-xs whitespace-nowrap ${
                  isActive ? "text-foreground font-medium" : "text-muted-foreground"
                }`}
              >
                {label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function WizardMode({
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
}: WizardModeProps) {
  const [step, setStep] = useState(1);
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

  const canProceedStep1 =
    form.staffId.trim() !== "" && form.invoiceNumber.trim() !== "";

  return (
    <div className="max-w-3xl mx-auto">
      <StepIndicator current={step} />

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Staff &amp; Invoice Info</CardTitle>
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
              <Label>Semester / Year / Dept</Label>
              <Input
                value={form.semesterYearDept}
                onChange={(e) => updateField("semesterYearDept", e.target.value)}
                placeholder="e.g. Fall 2025 \u2013 Math"
              />
            </div>
          </CardContent>
          <CardFooter className="justify-end">
            <Button onClick={() => setStep(2)} disabled={!canProceedStep1}>
              Next: Line Items
            </Button>
          </CardFooter>
        </Card>
      )}

      {step === 2 && (
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
          </CardContent>
          <CardFooter className="justify-between">
            <Button variant="outline" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button onClick={() => setStep(3)}>Next: Review</Button>
          </CardFooter>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Review &amp; Finalize</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm border rounded-lg p-4">
              <div className="text-muted-foreground">Invoice #</div>
              <div className="font-medium">{form.invoiceNumber || "\u2014"}</div>
              <div className="text-muted-foreground">Date</div>
              <div className="font-medium">{form.date || "\u2014"}</div>
              <div className="text-muted-foreground">Staff / Contact</div>
              <div className="font-medium">{form.contactName || "\u2014"}</div>
              <div className="text-muted-foreground">Department</div>
              <div className="font-medium">{form.department || "\u2014"}</div>
              <div className="text-muted-foreground">Account Number</div>
              <div className="font-medium">{form.accountNumber || "\u2014"}</div>
              <div className="text-muted-foreground">Account Code</div>
              <div className="font-medium">{form.accountCode || "\u2014"}</div>
              <div className="text-muted-foreground">Extension</div>
              <div className="font-medium">{form.contactExtension || "\u2014"}</div>
              <div className="text-muted-foreground">Email</div>
              <div className="font-medium">{form.contactEmail || "\u2014"}</div>
              <div className="text-muted-foreground">Semester / Year / Dept</div>
              <div className="font-medium">{form.semesterYearDept || "\u2014"}</div>
            </div>

            <div>
              <p className="text-sm font-semibold mb-2">Line Items</p>
              <div className="space-y-1 text-sm border rounded-lg p-4">
                {form.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between">
                    <span className="text-muted-foreground">
                      {item.description || "(no description)"} \u00d7 {item.quantity}
                    </span>
                    <span className="font-medium">
                      ${item.extendedPrice.toFixed(2)}
                    </span>
                  </div>
                ))}
                <div className="flex justify-between pt-2 border-t font-semibold">
                  <span>Total</span>
                  <span>${total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <PrismcoreUpload
              value={form.prismcorePath}
              onChange={(path) => updateField("prismcorePath", path)}
            />

            <div className="space-y-3">
              <p className="text-sm font-semibold">Signatures</p>
              <div className="space-y-2">
                {(["line1", "line2", "line3"] as const).map((line, idx) => (
                  <div key={line} className="space-y-1">
                    <Label>Signature {idx + 1}</Label>
                    <Input
                      value={form.signatures[line]}
                      onChange={(e) =>
                        updateField("signatures", {
                          ...form.signatures,
                          [line]: e.target.value,
                        })
                      }
                      placeholder={`Signature line ${idx + 1}`}
                    />
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
          <CardFooter className="justify-between">
            <Button variant="outline" onClick={() => setStep(2)}>
              Back
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={saveDraft} disabled={saving}>
                Save Draft
              </Button>
              <Button onClick={saveAndFinalize} disabled={saving}>
                Generate Invoice PDF
              </Button>
            </div>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
