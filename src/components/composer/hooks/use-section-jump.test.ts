import "@testing-library/jest-dom/vitest";
import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useSectionJump } from "./use-section-jump";

describe("useSectionJump", () => {
  beforeEach(() => {
    document.body.innerHTML = `<section id="section-people" data-anchor></section>`;
  });

  it("scrolls the matching section into view", () => {
    const scrollSpy = vi.fn();
    const el = document.getElementById("section-people")!;
    el.scrollIntoView = scrollSpy;

    const { result } = renderHook(() => useSectionJump());
    act(() => result.current.jump("section-people"));

    expect(scrollSpy).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
  });

  it("adds and removes a pulse class", () => {
    vi.useFakeTimers();
    const el = document.getElementById("section-people")!;
    el.scrollIntoView = vi.fn();

    const { result } = renderHook(() => useSectionJump());
    act(() => result.current.jump("section-people"));

    expect(el.classList.contains("composer-pulse")).toBe(true);
    act(() => vi.advanceTimersByTime(900));
    expect(el.classList.contains("composer-pulse")).toBe(false);
    vi.useRealTimers();
  });
});
