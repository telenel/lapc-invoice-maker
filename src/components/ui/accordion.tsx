"use client";

import { Accordion as AccordionPrimitive } from "@base-ui/react/accordion";
import { ChevronDown } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

function Accordion({
  className,
  keepMounted = true,
  ...props
}: AccordionPrimitive.Root.Props) {
  return (
    <AccordionPrimitive.Root
      data-slot="accordion"
      // Default to keepMounted so panel subtrees stay in the DOM (hidden
      // via data-closed) when collapsed. This preserves any inner form
      // state, keeps the content in-page search / screen-reader indexes,
      // and makes the height transition testable without flakiness.
      keepMounted={keepMounted}
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
