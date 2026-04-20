export type EditDialogMode = "legacy" | "v2";

export function resolveEditDialogMode(input: {
  featureFlagEnabled: boolean;
  override: string | null;
  hasTextbookSelection: boolean;
  selectionCount: number;
}): EditDialogMode {
  if (input.override === "legacy") return "legacy";
  if (input.override === "v2") return "v2";
  if (input.hasTextbookSelection && input.selectionCount !== 1) return "legacy";
  if (input.hasTextbookSelection && input.selectionCount === 1) return "v2";
  return input.featureFlagEnabled ? "v2" : "legacy";
}
