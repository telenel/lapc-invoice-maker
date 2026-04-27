import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { ColumnVisibilityToggle } from "@/components/products/column-visibility-toggle";

beforeAll(() => {
  // happy-dom doesn't ship a real localStorage; install a stub so the
  // component's persistence hook can run without throwing during tests.
  if (!("localStorage" in window) || typeof window.localStorage?.getItem !== "function") {
    const store = new Map<string, string>();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => {
          store.set(key, value);
        },
        removeItem: (key: string) => {
          store.delete(key);
        },
        clear: () => store.clear(),
        key: (i: number) => Array.from(store.keys())[i] ?? null,
        get length() {
          return store.size;
        },
      },
    });
  }
});

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    render: renderProp,
    ...rest
  }: {
    children?: ReactNode;
    onClick?: () => void;
    render?: ReactNode;
    [key: string]: unknown;
  }) => {
    if (renderProp) return <>{renderProp}</>;
    return (
      <button type="button" onClick={onClick} {...rest}>
        {children}
      </button>
    );
  },
}));

vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({
    render,
    children,
  }: {
    render?: ReactNode;
    children?: ReactNode;
  }) => <div>{render}{children}</div>,
  PopoverContent: ({ children }: { children: ReactNode }) => (
    <div data-testid="popover-content">{children}</div>
  ),
}));

afterEach(() => {
  cleanup();
});

describe("ColumnVisibilityToggle column presets", () => {
  it("renders all preset buttons inside the popover", () => {
    render(
      <ColumnVisibilityToggle
        runtimeOverride={null}
        onUserChange={vi.fn()}
        onRuntimeChange={vi.fn()}
        onResetRuntime={vi.fn()}
      />,
    );

    const popover = screen.getByTestId("popover-content");
    const utils = within(popover);
    expect(utils.getByRole("button", { name: /Default/i })).toBeInTheDocument();
    expect(utils.getByRole("button", { name: /Pricing/i })).toBeInTheDocument();
    expect(utils.getByRole("button", { name: /Inventory/i })).toBeInTheDocument();
    expect(utils.getByRole("button", { name: /Movers/i })).toBeInTheDocument();
    expect(utils.getByRole("button", { name: /Recency/i })).toBeInTheDocument();
    expect(utils.getByRole("button", { name: /^All\d/i })).toBeInTheDocument();
  });

  it("applies a preset's column set when clicked", async () => {
    const user = userEvent.setup();
    const onUserChange = vi.fn();
    render(
      <ColumnVisibilityToggle
        runtimeOverride={null}
        onUserChange={onUserChange}
        onRuntimeChange={vi.fn()}
        onResetRuntime={vi.fn()}
      />,
    );

    const popover = screen.getByTestId("popover-content");
    await user.click(within(popover).getByRole("button", { name: /Movers/i }));

    // The Movers preset surfaces the velocity columns.
    const lastCall = onUserChange.mock.calls.at(-1);
    expect(lastCall?.[0]).toEqual(expect.arrayContaining(["units_1y", "revenue_1y", "txns_1y"]));
  });

  it("routes preset selection through onRuntimeChange when a runtime override is active", async () => {
    const user = userEvent.setup();
    const onRuntimeChange = vi.fn();
    render(
      <ColumnVisibilityToggle
        runtimeOverride={["margin"]}
        onUserChange={vi.fn()}
        onRuntimeChange={onRuntimeChange}
        onResetRuntime={vi.fn()}
      />,
    );

    const popover = screen.getByTestId("popover-content");
    await user.click(within(popover).getByRole("button", { name: /Pricing/i }));

    const lastCall = onRuntimeChange.mock.calls.at(-1);
    expect(lastCall?.[0]).toEqual(expect.arrayContaining(["margin", "revenue_1y"]));
  });
});
