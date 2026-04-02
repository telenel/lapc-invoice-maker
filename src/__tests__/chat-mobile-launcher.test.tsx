import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChatMobileLauncher } from "@/components/chat/chat-mobile-launcher";

type SessionState =
  | {
      status: "authenticated";
      data: { user: { id: string; name: string } };
    }
  | {
      status: "loading" | "unauthenticated";
      data: null;
    };

let sessionState: SessionState = {
  status: "authenticated",
  data: { user: { id: "user-1", name: "Jane Doe" } },
};

vi.mock("next-auth/react", () => ({
  useSession: () => sessionState,
}));

vi.mock("framer-motion", () => ({
  motion: {
    button: ({ children, ...props }: React.ComponentProps<"button">) => (
      <button {...props}>{children}</button>
    ),
    span: ({ children, ...props }: React.ComponentProps<"span">) => (
      <span {...props}>{children}</span>
    ),
  },
}));

vi.mock("@/components/chat/chat-mobile-sheet", () => ({
  ChatMobileSheet: () => <div data-testid="mobile-sheet">sheet</div>,
}));

describe("ChatMobileLauncher", () => {
  beforeEach(() => {
    sessionState = {
      status: "authenticated",
      data: { user: { id: "user-1", name: "Jane Doe" } },
    };
  });

  it("resets the open sheet state after auth is lost", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<ChatMobileLauncher />);

    await user.click(screen.getByRole("button", { name: "Open AI Assistant" }));
    expect(screen.getByTestId("mobile-sheet")).toBeInTheDocument();

    sessionState = { status: "unauthenticated", data: null };
    rerender(<ChatMobileLauncher />);

    expect(screen.queryByTestId("mobile-sheet")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open AI Assistant" })).not.toBeInTheDocument();

    sessionState = {
      status: "authenticated",
      data: { user: { id: "user-1", name: "Jane Doe" } },
    };
    rerender(<ChatMobileLauncher />);

    expect(screen.getByRole("button", { name: "Open AI Assistant" })).toBeInTheDocument();
    expect(screen.queryByTestId("mobile-sheet")).not.toBeInTheDocument();
  });
});
