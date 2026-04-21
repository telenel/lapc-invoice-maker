"use client";

import { Accordion as AccordionPrimitive } from "@base-ui/react/accordion";
import { ChevronDown } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

function Accordion({ className, ...props }: AccordionPrimitive.Root.Props) {
  // Deliberately leaves `keepMounted` at Base UI's default (false). That
  // unmounts collapsed panel subtrees, removing their focusable inputs
  // from the tab order and the accessibility tree — important here
  // because the More / Advanced panels contain many form inputs that
  // would otherwise stay keyboard-reachable when visually closed.
  //
  // Callers that need content persistence across open/close can opt in
  // explicitly via `<Accordion keepMounted>` — the primary edit dialog
  // does not need this because form state lifts to the parent.
  return (
    <AccordionPrimitive.Root
      data-slot="accordion"
      className={cn("flex w-full flex-col", className)}
      {...props}
    />
  );
}

function AccordionItem({ className, ...props }: AccordionPrimitive.Item.Props) {
  return (
    <AccordionPrimitive.Item
      data-slot="accordion-item"
      className={cn("border-b border-border/60 last:border-b-0", className)}
      {...props}
    />
  );
}

function AccordionTrigger({
  className,
  children,
  ...props
}: AccordionPrimitive.Trigger.Props) {
  return (
    <AccordionPrimitive.Header
      data-slot="accordion-header"
      className="flex"
    >
      <AccordionPrimitive.Trigger
        data-slot="accordion-trigger"
        className={cn(
          "group flex flex-1 items-center justify-between gap-2 py-3 text-left text-sm font-medium text-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 [&[data-panel-open]>svg]:rotate-180",
          className,
        )}
        {...props}
      >
        {children}
        <ChevronDown
          aria-hidden="true"
          className="size-4 shrink-0 text-muted-foreground transition-transform duration-200"
        />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  );
}

function AccordionContent({
  className,
  children,
  ...props
}: AccordionPrimitive.Panel.Props) {
  return (
    <AccordionPrimitive.Panel
      data-slot="accordion-content"
      className={cn(
        // Panel emits `data-open` (or `data-closed`) from Base UI's
        // collapsible state mapping — NOT `data-panel-open`, which only
        // shows up on the Trigger element. Keying the height transition
        // to `data-open` is what actually reveals the content on click.
        "overflow-hidden text-sm transition-[height] duration-200 h-0 data-[open]:h-[var(--accordion-panel-height)]",
        className,
      )}
      {...props}
    >
      <div className="pt-1 pb-4">{children}</div>
    </AccordionPrimitive.Panel>
  );
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };
