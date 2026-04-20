"use client";

import type { EditItemDialogProps } from "./edit-item-dialog-legacy";
import { EditItemDialogLegacy, buildPatch } from "./edit-item-dialog-legacy";
import { resolveEditDialogMode } from "./edit-item-dialog-mode";

type EditItemDialogWrapperProps = EditItemDialogProps & {
  editDialogOverride?: string | null;
};

function EditItemDialogV2(props: EditItemDialogProps) {
  // Placeholder seam for the later v2 rollout. For now, v2 resolves to the
  // same behavior so the wrapper and mode plumbing can land safely first.
  return <EditItemDialogLegacy {...props} />;
}

export { buildPatch };

export function EditItemDialog({ editDialogOverride, items, ...props }: EditItemDialogWrapperProps) {
  const mode = resolveEditDialogMode({
    featureFlagEnabled: process.env.NEXT_PUBLIC_PRODUCTS_EDIT_DIALOG_V2 === "true",
    override: editDialogOverride ?? null,
    hasTextbookSelection: items.some((item) => item.isTextbook),
  });

  const Impl = mode === "v2" ? EditItemDialogV2 : EditItemDialogLegacy;
  return <Impl {...props} items={items} />;
}
