"use client";

import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { templateApi } from "@/domains/template/api-client";
import type { TemplateResponse } from "@/domains/template/types";

interface SavePayload {
  name: string;
  category: string;
  notes: string;
}

interface Props {
  open: boolean;
  type: "INVOICE" | "QUOTE";
  mode: "load" | "save";
  initialPayload: SavePayload;
  onOpenChange: (open: boolean) => void;
  onLoadTemplate: (template: TemplateResponse) => void;
  onSaveTemplate: (payload: SavePayload) => void;
}

export function TemplatesDrawer({
  open,
  type,
  mode,
  initialPayload,
  onOpenChange,
  onLoadTemplate,
  onSaveTemplate,
}: Props) {
  const [tab, setTab] = useState<"load" | "save">(mode);
  const [templates, setTemplates] = useState<TemplateResponse[]>([]);
  const [name, setName] = useState(initialPayload.name);
  const [category, setCategory] = useState(initialPayload.category);
  const [notes, setNotes] = useState(initialPayload.notes);

  useEffect(() => {
    if (open) setTab(mode);
  }, [open, mode]);

  useEffect(() => {
    if (!open || tab !== "load") return;
    templateApi
      .list(type)
      .then(setTemplates)
      .catch(() => {});
  }, [open, tab, type]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Templates</SheetTitle>
        </SheetHeader>
        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as "load" | "save")}
          className="flex-1 flex flex-col"
        >
          <TabsList className="mx-4 mt-4">
            <TabsTrigger value="load">Load</TabsTrigger>
            <TabsTrigger value="save">Save</TabsTrigger>
          </TabsList>
          <TabsContent value="load" className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
            {templates.length === 0 && (
              <p className="text-sm text-muted-foreground">No templates yet.</p>
            )}
            {templates.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  onLoadTemplate(t);
                  onOpenChange(false);
                }}
                className="w-full rounded-lg border border-border bg-card p-3 text-left hover:bg-muted"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm">{t.name}</span>
                  <span className="text-[11px] text-muted-foreground">{t.items.length} items</span>
                </div>
                <p className="text-[12px] text-muted-foreground mt-1">
                  {t.category} · {t.notes || "—"}
                </p>
              </button>
            ))}
          </TabsContent>
          <TabsContent value="save" className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="tpl-name">Template name</Label>
              <Input id="tpl-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tpl-cat">Category</Label>
              <Input id="tpl-cat" value={category} onChange={(e) => setCategory(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tpl-notes">Notes (optional)</Label>
              <Textarea id="tpl-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <div className="rounded-lg border border-info-border bg-info-bg/40 p-2.5 text-[12px] text-foreground">
              Items, category, notes, and margin/tax settings are saved. Requestor, account number, dates, and signatures are not.
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button disabled={!name.trim()} onClick={() => onSaveTemplate({ name, category, notes })}>
                Save Template
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
