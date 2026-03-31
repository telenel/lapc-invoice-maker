"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { adminApi } from "@/domains/admin/api-client";

interface ContactBlock {
  name: string;
  phone: string;
  email: string;
  note: string;
}

const EMPTY: ContactBlock = { name: "", phone: "", email: "", note: "" };

const KEYS = [
  { key: "quote_contact_default", title: "Default Contact", description: "Shown on non-catering quote approval pages" },
  { key: "quote_contact_catering", title: "Catering Contact", description: "Shown on catering quote approval pages" },
] as const;

export function QuoteContactSettings() {
  const [blocks, setBlocks] = useState<Record<string, ContactBlock>>({
    quote_contact_default: { ...EMPTY },
    quote_contact_catering: { ...EMPTY },
  });
  const [savingByKey, setSavingByKey] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    try {
      const data = await adminApi.listSettings();
      const next: Record<string, ContactBlock> = { ...blocks };
      for (const item of data) {
        if (item.key in next) {
          next[item.key] = { ...EMPTY, ...(item.value as ContactBlock) };
        }
      }
      setBlocks(next);
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [load]);

  async function save(key: string) {
    setSavingByKey((prev) => ({ ...prev, [key]: true }));
    try {
      await adminApi.saveSetting(key, blocks[key]);
      toast.success("Contact info saved");
    } catch {
      toast.error("Failed to save contact info");
    } finally {
      setSavingByKey((prev) => ({ ...prev, [key]: false }));
    }
  }

  function update(key: string, field: keyof ContactBlock, value: string) {
    setBlocks((prev) => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }));
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Quote Contact Information</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Contact details shown on public quote approval pages so recipients know who to reach.
        </p>
      </div>

      {KEYS.map(({ key, title, description }) => (
        <Card key={key}>
          <CardHeader>
            <CardTitle>{title}</CardTitle>
            <p className="text-sm text-muted-foreground">{description}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input
                  value={blocks[key].name}
                  onChange={(e) => update(key, "name", e.target.value)}
                  placeholder="Campus Bookstore"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input
                  value={blocks[key].phone}
                  onChange={(e) => update(key, "phone", e.target.value)}
                  placeholder="(818) 710-4242"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={blocks[key].email}
                  onChange={(e) => update(key, "email", e.target.value)}
                  placeholder="bookstore@piercecollege.edu"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Additional Note</Label>
              <Textarea
                value={blocks[key].note}
                onChange={(e) => update(key, "note", e.target.value)}
                placeholder="For catering questions, please call during business hours."
                rows={2}
              />
            </div>
            <Button onClick={() => save(key)} disabled={Boolean(savingByKey[key])} size="sm">
              {savingByKey[key] ? "Saving..." : "Save"}
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
