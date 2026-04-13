"use client";

import { useSession } from "next-auth/react";

export function RepoLink({ buildSha }: { buildSha?: string | null }) {
  const { status } = useSession();

  if (status !== "authenticated") return null;

  const overlayLabel = buildSha ? `GH ${buildSha}` : "GH";

  return (
    <a
      href="https://github.com/telenel/laportal"
      target="_blank"
      rel="noopener noreferrer"
      aria-label={overlayLabel}
      title={buildSha ? `github.com/telenel/laportal · ${buildSha}` : "github.com/telenel/laportal"}
      className="fixed bottom-3 left-4 z-10 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground/35 transition-colors hover:text-muted-foreground/60"
    >
      <span>GH</span>
      {buildSha ? <span className="ml-2 tracking-[0.12em]">{buildSha}</span> : null}
    </a>
  );
}
