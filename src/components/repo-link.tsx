"use client";

import { useSession } from "next-auth/react";

export function RepoLink() {
  const { status } = useSession();

  if (status !== "authenticated") return null;

  return (
    <a
      href="https://github.com/telenel/laportal"
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-3 left-4 font-mono text-[10px] lowercase text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors z-10"
    >
      github.com/telenel/laportal
    </a>
  );
}
