"use client";

import { useSession } from "next-auth/react";

export function Footer() {
  const { status } = useSession();

  if (status !== "authenticated") return null;

  return (
    <footer className="mt-auto border-t border-border/40 py-4 text-center text-xs text-muted-foreground/60">
      <a
        href="https://github.com/telenel/lapc-invoice-maker"
        target="_blank"
        rel="noopener noreferrer"
        className="hover:text-muted-foreground transition-colors"
      >
        github.com/telenel/lapc-invoice-maker
      </a>
    </footer>
  );
}
