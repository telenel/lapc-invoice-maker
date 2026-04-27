import "@testing-library/jest-dom/vitest";
import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { useDensity } from "./use-density";

function installLocalStorageMock() {
  const storage = new Map<string, string>();
  const mock = {
    getItem: vi.fn((key: string) => storage.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      storage.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      storage.delete(key);
    }),
    clear: vi.fn(() => {
      storage.clear();
    }),
    key: vi.fn(),
    length: 0,
  };
  vi.stubGlobal("localStorage", mock);
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: mock,
  });
  return mock;
}

describe("useDensity", () => {
  beforeEach(() => {
    installLocalStorageMock();
  });

  it("defaults to standard", () => {
    const { result } = renderHook(() => useDensity());
    expect(result.current.density).toBe("standard");
  });

  it("persists changes to localStorage", () => {
    const { result } = renderHook(() => useDensity());
    act(() => result.current.setDensity("compact"));
    expect(localStorage.getItem("composer.density")).toBe("compact");
  });

  it("reads persisted value on mount", () => {
    localStorage.setItem("composer.density", "comfortable");
    const { result } = renderHook(() => useDensity());
    expect(result.current.density).toBe("comfortable");
  });

  it("ignores invalid stored values", () => {
    localStorage.setItem("composer.density", "junk");
    const { result } = renderHook(() => useDensity());
    expect(result.current.density).toBe("standard");
  });
});
