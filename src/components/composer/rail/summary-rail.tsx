"use client";

import { ReadinessCard } from "./readiness-card";
import { ChecklistCard } from "./checklist-card";
import { DraftStateCard } from "./draft-state-card";
import type { ChecklistEntry, ComposerTotals, DocType, SectionAnchor } from "../types";

interface Props {
  readiness: number;
  blockerCount: number;
  docType: DocType;
  totals: ComposerTotals;
  marginEnabled: boolean;
  taxEnabled: boolean;
  taxRate: number;
  accountNumber: string;
  department: string;
  saving: boolean;
  primaryDisabled: boolean;
  canSaveDraft: boolean;
  checklist: ChecklistEntry[];
  isDirty: boolean;
  savingDraft: boolean;
  lastSavedAt: number | null;
  onPrimaryAction: () => void;
  onSaveDraft: () => void;
  onPrintRegister: () => void;
  onJumpToBlockers: () => void;
  onJump: (anchor: SectionAnchor) => void;
}

export function SummaryRail(p: Props) {
  return (
    <div className="space-y-3">
      <ReadinessCard
        readiness={p.readiness} blockerCount={p.blockerCount} docType={p.docType} totals={p.totals}
        marginEnabled={p.marginEnabled} taxEnabled={p.taxEnabled} taxRate={p.taxRate}
        accountNumber={p.accountNumber} department={p.department} saving={p.saving}
        primaryDisabled={p.primaryDisabled} canSaveDraft={p.canSaveDraft}
        onPrimaryAction={p.onPrimaryAction} onSaveDraft={p.onSaveDraft} onPrintRegister={p.onPrintRegister}
        onJumpToBlockers={p.onJumpToBlockers}
        onJumpToAccount={() => p.onJump("section-department")}
      />
      <ChecklistCard checklist={p.checklist} onJump={p.onJump} />
      <DraftStateCard isDirty={p.isDirty} savingDraft={p.savingDraft} lastSavedAt={p.lastSavedAt} />
    </div>
  );
}
