"use client";

import { SectionCard } from "./section-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { AccountNumberSelect } from "@/components/invoice/account-number-select";
import type { useInvoiceForm } from "@/components/invoice/invoice-form";
import type { useQuoteForm } from "@/components/quote/quote-form";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEPARTMENTS = ["BKST", "AUXS", "MATH", "BIOL", "ATHL", "STDV", "FINC"];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Props {
  composer: ReturnType<typeof useInvoiceForm> | ReturnType<typeof useQuoteForm>;
  sectionStatus: "default" | "complete" | "blocker";
}

// ---------------------------------------------------------------------------
// DepartmentAccountSection
// ---------------------------------------------------------------------------

// Bridge type: both InvoiceFormData and QuoteFormData share these string fields.
// Casting composer to this shape avoids the "union of generic functions is not callable"
// TS error while remaining runtime-safe — the fields written here exist on both forms.
// Keys are constrained to the 3 fields this section writes so typos fail at compile time.
type DeptFieldKey = "department" | "accountCode" | "semesterYearDept";
type FieldWriter = { updateField: (key: DeptFieldKey, value: string) => void };

export function DepartmentAccountSection({ composer, sectionStatus }: Props) {
  const f = composer.form;
  const write = (composer as unknown as FieldWriter).updateField;

  return (
    <SectionCard
      step={2}
      title="Department & Account"
      anchor="section-department"
      status={sectionStatus}
    >
      <div className="grid grid-cols-1 md:grid-cols-[1.2fr_1fr_1fr] gap-3.5">
        {/* Department */}
        <div className="space-y-1.5">
          <Label
            htmlFor="dept-select"
            className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground"
          >
            Department
          </Label>
          <Select
            id="dept-select"
            value={f.department}
            onValueChange={(v) => write("department", v ?? "")}
          >
            <SelectTrigger aria-label="Department" className="w-full">
              <SelectValue placeholder="Select department" />
            </SelectTrigger>
            <SelectContent>
              {DEPARTMENTS.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Account number */}
        <div className="space-y-1.5">
          <Label className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
            Account number
          </Label>
          {/*
            AccountNumberSelect's updateField generic is keyed on InvoiceFormData,
            but the 2 fields it touches (staffId, accountNumber) exist on QuoteFormData
            with the same string type. Cast to bridge the generic mismatch — runtime-safe.
          */}
          <AccountNumberSelect
            form={f}
            updateField={
              composer.updateField as Parameters<
                typeof AccountNumberSelect
              >[0]["updateField"]
            }
            staffAccountNumbers={composer.staffAccountNumbers}
          />
          {!f.accountNumber && (
            <p
              role="status"
              aria-live="polite"
              className="text-[12px] text-destructive"
            >
              Required for GL posting — verify with department
            </p>
          )}
        </div>

        {/* Account code */}
        <div className="space-y-1.5">
          <Label
            htmlFor="account-code"
            className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground"
          >
            Account code
          </Label>
          <Input
            id="account-code"
            value={f.accountCode}
            onChange={(e) => write("accountCode", e.target.value)}
            placeholder="—"
            className="font-mono"
          />
        </div>
      </div>

      {/* Semester / term — invoice only (QuoteFormData has no semesterYearDept) */}
      {"semesterYearDept" in f && (
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3.5">
          <div className="space-y-1.5">
            <Label
              htmlFor="semester-input"
              className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground"
            >
              Semester (PDF cover)
            </Label>
            <Input
              id="semester-input"
              value={f.semesterYearDept}
              onChange={(e) => write("semesterYearDept", e.target.value)}
              placeholder={f.department || "Auto-generated from department"}
              className="font-mono"
            />
          </div>
        </div>
      )}
    </SectionCard>
  );
}
