"use client";

import { useState, useCallback, useRef } from "react";
import type { StaffDetailResponse, AccountNumberResponse, SignerHistoryResponse } from "@/domains/staff/types";
import type { InvoiceFormData } from "./use-invoice-form-state";

// Re-exported for backward compatibility with account-select.tsx and keyboard-mode.tsx
export type StaffAccountNumber = AccountNumberResponse;

export function useStaffAutofill(
  setForm: React.Dispatch<React.SetStateAction<InvoiceFormData>>
) {
  const [staffAccountNumbers, setStaffAccountNumbers] = useState<
    StaffAccountNumber[]
  >([]);

  // Track the original staff field values so we can detect user edits
  const originalStaffRef = useRef<{
    extension: string;
    email: string;
    phone: string;
    department: string;
  } | null>(null);

  const handleStaffSelect = useCallback(
    (staff: StaffDetailResponse) => {
      // Most recently used account number (first in the list, already sorted by lastUsedAt desc)
      const latestAccount = staff.accountNumbers?.[0];
      setStaffAccountNumbers(staff.accountNumbers ?? []);
      originalStaffRef.current = {
        extension: staff.extension,
        email: staff.email,
        phone: staff.phone,
        department: staff.department,
      };

      // Auto-populate signatures from signer history (sorted by position)
      const histories = staff.signerHistories ?? [];
      const byPosition: Record<number, SignerHistoryResponse> = {};
      for (const h of histories) {
        // Keep only the first entry per position (already sorted by lastUsedAt desc)
        if (!(h.position in byPosition)) byPosition[h.position] = h;
      }

      const lines = ["line1", "line2", "line3"] as const;
      const sigDisplays: Record<string, string> = {
        line1: "",
        line2: "",
        line3: "",
      };
      const sigIds: Record<string, string> = { line1: "", line2: "", line3: "" };
      lines.forEach((line, idx) => {
        const h = byPosition[idx];
        if (h) {
          const title = h.signer.title ? `, ${h.signer.title}` : "";
          sigDisplays[line] = `${h.signer.name}${title}`;
          sigIds[line] = h.signer.id;
        }
      });

      // If the staff has dedicated account number records, use those for the
      // account number field and the staff-level accountCode for the code field.
      // Otherwise fall back to the staff-level accountCode as the account number
      // (users often enter account numbers there when no separate records exist).
      const hasAccountNumbers = (staff.accountNumbers?.length ?? 0) > 0;

      setForm((prev) => ({
        ...prev,
        staffId: staff.id,
        department: staff.department,
        accountNumber: hasAccountNumbers
          ? (latestAccount?.accountCode ?? "")
          : staff.accountCode,
        accountCode: hasAccountNumbers ? staff.accountCode : "",
        contactName: staff.name,
        contactExtension: staff.extension,
        contactEmail: staff.email,
        contactPhone: staff.phone,
        approvalChain: staff.approvalChain,
        signatures: {
          line1: sigDisplays.line1,
          line2: sigDisplays.line2,
          line3: sigDisplays.line3,
        },
        signatureStaffIds: {
          line1: sigIds.line1,
          line2: sigIds.line2,
          line3: sigIds.line3,
        },
      }));
    },
    [setForm]
  );

  // Called after the inline StaffForm dialog saves, to re-sync form fields
  const handleStaffEdit = useCallback(
    (updated: StaffDetailResponse) => {
      originalStaffRef.current = {
        extension: updated.extension,
        email: updated.email,
        phone: updated.phone,
        department: updated.department,
      };
      setForm((prev) => ({
        ...prev,
        department: updated.department,
        accountCode: updated.accountCode,
        contactName: updated.name,
        contactExtension: updated.extension,
        contactEmail: updated.email,
        contactPhone: updated.phone,
        approvalChain: updated.approvalChain,
      }));
    },
    [setForm]
  );

  return {
    staffAccountNumbers,
    originalStaffRef,
    handleStaffSelect,
    handleStaffEdit,
  };
}
