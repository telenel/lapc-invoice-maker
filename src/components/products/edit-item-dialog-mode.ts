export type EditDialogMode = "legacy" | "v2";

export function resolveEditDialogMode(input: {
  featureFlagEnabled: boolean;
  override: string | null;
  hasTextbookSelection: boolean;
  selectionCount: number;
}): EditDialogMode {
  if (input.override === "legacy") return "legacy";
  if (input.override === "v2") return "v2";
  return "v2";
}
