import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let sessionStatus: "authenticated" | "unauthenticated" | "loading" = "authenticated";

vi.mock("next-auth/react", () => ({
  useSession: () => ({
    status: sessionStatus,
  }),
}));

import { RepoLink } from "@/components/repo-link";

describe("RepoLink", () => {
  beforeEach(() => {
    sessionStatus = "authenticated";
  });

  afterEach(() => {
    cleanup();
  });

  it("shows the build sha within the GitHub overlay for authenticated users", () => {
    render(<RepoLink buildSha="0cc2e07" />);

    const link = screen.getByRole("link", { name: /gh 0cc2e07/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "https://github.com/telenel/laportal");
  });

  it("stays hidden for unauthenticated users", () => {
    sessionStatus = "unauthenticated";

    render(<RepoLink buildSha="0cc2e07" />);

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
