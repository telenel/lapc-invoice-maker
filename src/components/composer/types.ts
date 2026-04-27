export type DocType = "invoice" | "quote";

export type SectionAnchor =
  | "section-people"
  | "section-department"
  | "section-details"
  | "section-items"
  | "section-notes"
  | "section-approval";

export type Density = "compact" | "standard" | "comfortable";

export interface BlockerEntry {
  field: string;
  label: string;
  anchor: SectionAnchor;
}

export interface ChecklistEntry {
  id: string;
  label: string;
  anchor: SectionAnchor;
  complete: boolean;
  blocker: boolean;
}

export interface ComposerTotals {
  subtotal: number;
  taxableSubtotal: number;
  taxAmount: number;
  marginAmount: number;
  grandTotal: number;
  itemCount: number;
  taxableCount: number;
}

export interface ApproverSlotVM {
  slotIndex: 0 | 1 | 2;
  required: boolean;
  staffId: string;
  display: string;
}

export type ComposerStatus =
  | "DRAFT"
  | "FINALIZED"
  | "SENT"
  | "PAID"
  | "EXPIRED"
  | "DECLINED"
  | "REVISED"
  | (string & {});
