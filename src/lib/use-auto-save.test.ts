import "@testing-library/jest-dom/vitest";
import { renderHook } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { useAutoSave } from "./use-auto-save";

vi.mock("@/domains/user-draft/api-client", () => ({
  userDraftApi: { save: vi.fn().mockResolvedValue(undefined), get: vi.fn(), clear: vi.fn() },
}));

describe("useAutoSave state flags", () => {
  it("returns isDirty=false initially", () => {
    const { result } = renderHook(() => useAutoSave({ x: 1 }, "key", "user-1"));
    expect(result.current.isDirty).toBe(false);
  });

  it("flips isDirty=true when state changes", () => {
    let state = { x: 1 };
    const { result, rerender } = renderHook(() => useAutoSave(state, "key", "user-1"));
    state = { x: 2 };
    rerender();
    expect(result.current.isDirty).toBe(true);
  });
});
