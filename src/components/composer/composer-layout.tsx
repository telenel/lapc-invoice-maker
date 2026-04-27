import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface Props {
  workflow: ReactNode;
  rail: ReactNode;
  banners?: ReactNode;
  className?: string;
}

export function ComposerLayout({ workflow, rail, banners, className }: Props) {
  return (
    <main
      className={cn(
        "mx-auto max-w-[1440px] px-6 pb-20 pt-4",
        "grid grid-cols-1 items-start gap-6 lg:grid-cols-[1fr_360px]",
        className,
      )}
    >
      <div className="min-w-0 space-y-3.5">
        {banners}
        {workflow}
      </div>
      <aside className="lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
        {rail}
      </aside>
    </main>
  );
}
