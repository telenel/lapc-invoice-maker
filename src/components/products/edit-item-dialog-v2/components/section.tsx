"use client";

/**
 * Bordered-card group used for each tab content's logical section. The visual
 * treatment (washed `bg-card/60` and inner border) is unchanged from the
 * monolith for Phase 1 — Phase 2 will replace this with <Separator /> dividers
 * per the redesign plan.
 */
export function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-xl border border-border/60 bg-card/60 p-4">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}
