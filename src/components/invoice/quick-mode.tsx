"use client";

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
import { StaffSelect } from "./staff-select";
import { LineItems } from "./line-items";
import { QuickPickPanel } from "./quick-pick-panel";
import { PrismcoreUpload } from "./prismcore-upload";
import { AccountSelect } from "./account-select";
import type { InvoiceFormData, InvoiceItem, StaffAccountNumber } from "./invoice-form";

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
  handleStaffSelect: (staff: {
    id: string;
    name: string;
    title: string;
    department: string;
    accountCode: string;
    extension: string;
    email: string;
    phone: string;
    approvalChain: string[];
  }) => void;
  staffAccountNumbers: StaffAccountNumber[];
  saveDraft: () => Promise<void>;
  saveAndFinalize: () => Promise<void>;
  saving: boolean;
}

export function QuickMode({
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
  saving,
}: QuickModeProps) {
  // Quick-pick selection: find first empty slot or add new
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
      {/* ── Left card: Staff & Info ── */}
      <Card>
        <CardHeader>
          <CardTitle>Staff &amp; Info</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label>Staff Member</Label>
            <StaffSelect
              selectedId={form.staffId}
              onSelect={handleStaffSelect}
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
                value={form.accountCode}
                onChange={(v) => updateField("accountCode", v)}
                staffId={form.staffId}
                accountNumbers={staffAccountNumbers}
              />
            </div>
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
              placeholder="e.g. Fall 2025 – Math"
            />
          </div>

          {/* Signatures */}
          <div className="space-y-3 pt-2">
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

          {/* PrismCore upload */}
          <PrismcoreUpload
            value={form.prismcorePath}
            onChange={(path) => updateField("prismcorePath", path)}
          />
        </CardContent>
      </Card>

      {/* ── Right card: Line Items ── */}
      <Card>
        <CardHeader>
          <CardTitle>Line Items</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <QuickPickPanel
            department={form.department}
            onSelect={handleQuickPick}
          />
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
              placeholder="Additional notes or comments…"
              rows={3}
            />
          </div>

          {/* Action buttons */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={saveDraft}
              disabled={saving}
            >
              Save Draft
            </Button>
            <Button onClick={saveAndFinalize} disabled={saving}>
              Generate Invoice PDF
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
