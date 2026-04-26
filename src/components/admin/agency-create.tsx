"use client";

import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import type { AgencyRecord } from "@/domains/agency/types";

type Mode = "mirror" | "advanced";

interface Lookups {
  agencyTypes: Array<{ id: number; description: string }>;
  statementCodes: Array<{ id: number; description: string }>;
  nonMerchOpts: Array<{ id: number; description: string }>;
  tenderCodes: Array<{ id: number; description: string }>;
}

interface CreateResult {
  newAgencyId: number;
  newAgencyNumber: string;
  newName: string;
}

export function AgencyCreate() {
  const [mode, setMode] = useState<Mode>("mirror");
  const [lookups, setLookups] = useState<Lookups | null>(null);
  const [result, setResult] = useState<CreateResult | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/agencies/lookups");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as Lookups;
        setLookups(data);
      } catch (err) {
        toast.error("Failed to load lookups", {
          description: err instanceof Error ? err.message : String(err),
        });
      }
    })();
  }, []);

  return (
    <div className="container mx-auto space-y-6 py-6">
      <div>
        <h1 className="text-2xl font-semibold">Add a new account</h1>
        <p className="text-muted-foreground text-sm">
          Pick <strong>Mirror existing</strong> to clone any current account, or{" "}
          <strong>Build from scratch</strong> for full control over every parameter.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex gap-2">
            <Button
              variant={mode === "mirror" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setMode("mirror");
                setResult(null);
              }}
            >
              Mirror existing
            </Button>
            <Button
              variant={mode === "advanced" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setMode("advanced");
                setResult(null);
              }}
            >
              Build from scratch
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {mode === "mirror" ? (
            <MirrorMode onResult={setResult} />
          ) : (
            <AdvancedMode lookups={lookups} onResult={setResult} />
          )}
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>Created</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <p>
              Account <strong className="font-mono">{result.newAgencyNumber}</strong>{" "}
              created with AgencyID <strong>{result.newAgencyId}</strong>.
            </p>
            <p className="text-muted-foreground mt-2 text-xs">
              The new account has been pushed to the registers via{" "}
              <code>SP_ARAcctResendToPos</code> and is tenderable now.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ---------- Mirror mode ----------

function MirrorMode({ onResult }: { onResult: (r: CreateResult) => void }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<AgencyRecord[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedSource, setSelectedSource] = useState<AgencyRecord | null>(null);
  const [newAgencyNumber, setNewAgencyNumber] = useState("");
  const [newName, setNewName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Debounced search
  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await fetch(
          `/api/agencies/search?q=${encodeURIComponent(searchQuery.trim())}&limit=25`,
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { agencies: AgencyRecord[] };
        setSearchResults(data.agencies);
      } catch (err) {
        toast.error("Search failed", {
          description: err instanceof Error ? err.message : String(err),
        });
      } finally {
        setSearchLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  function pickSource(a: AgencyRecord) {
    setSelectedSource(a);
    if (newName.length === 0) setNewName(a.agencyNumber);
  }

  async function submit() {
    if (!selectedSource) return;
    if (newAgencyNumber.trim().length === 0 || newName.trim().length === 0) {
      toast.error("Account Code and Name are required.");
      return;
    }
    if (
      !window.confirm(
        `Create new account "${newAgencyNumber}" by mirroring "${selectedSource.agencyNumber}"?\n\n` +
          `This writes to Prism and pushes to the registers.`,
      )
    ) {
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/agencies/clone-single", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceAgencyId: selectedSource.agencyId,
          newAgencyNumber: newAgencyNumber.trim(),
          newName: newName.trim(),
        }),
      });
      const body = (await res.json()) as CreateResult & { error?: string };
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      toast.success(`Created ${body.newAgencyNumber}`);
      onResult(body);
      // Reset for next add
      setSearchQuery("");
      setSearchResults([]);
      setSelectedSource(null);
      setNewAgencyNumber("");
      setNewName("");
    } catch (err) {
      toast.error("Create failed", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="source-search">1. Find a template account to mirror</Label>
        <Input
          id="source-search"
          placeholder="Type any part of an existing AgencyNumber or Name (e.g. PWI25EOPS)"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value.toUpperCase())}
        />
      </div>

      {searchQuery.trim().length >= 2 && (
        <div className="rounded-md border">
          {searchLoading ? (
            <div className="text-muted-foreground p-3 text-sm">Searching…</div>
          ) : searchResults.length === 0 ? (
            <div className="text-muted-foreground p-3 text-sm">No matches.</div>
          ) : (
            <ul className="divide-y">
              {searchResults.map((a) => (
                <li
                  key={a.agencyId}
                  className={`flex cursor-pointer items-center justify-between px-3 py-2 hover:bg-muted ${
                    selectedSource?.agencyId === a.agencyId ? "bg-muted" : ""
                  }`}
                  onClick={() => pickSource(a)}
                >
                  <div>
                    <div className="font-mono text-xs">{a.agencyNumber}</div>
                    <div className="text-muted-foreground text-xs">{a.name}</div>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <Badge variant="secondary">type {a.agencyTypeId}</Badge>
                    {a.creditLimit > 0 && (
                      <Badge variant="secondary">${a.creditLimit.toLocaleString()}</Badge>
                    )}
                    {selectedSource?.agencyId === a.agencyId && <Badge>Selected</Badge>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {selectedSource && (
        <div className="space-y-3 rounded-md border p-3">
          <div className="text-sm">
            Mirroring <span className="font-mono">{selectedSource.agencyNumber}</span> —
            all 50 inherited fields will be copied. Set the new identity:
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="new-agency-number">New Account Code</Label>
              <Input
                id="new-agency-number"
                placeholder="e.g. PSP26ANTHRODEPT"
                value={newAgencyNumber}
                onChange={(e) => setNewAgencyNumber(e.target.value.toUpperCase())}
                maxLength={26}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="new-name">New Account Name</Label>
              <Input
                id="new-name"
                placeholder="Display name (often = Account Code)"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                maxLength={80}
              />
            </div>
          </div>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? "Creating…" : "Create account"}
          </Button>
        </div>
      )}
    </div>
  );
}

// ---------- Advanced mode ----------

interface AdvancedFormState {
  agencyNumber: string;
  name: string;
  agencyTypeId: number;
  tenderCode?: number;
  creditLimit: string;
  statementCodeId?: number;
  nonMerchOptId?: number;
  fAccessibleOnline: boolean;
  fInvoiceInAR: boolean;
  fPrintBalance: boolean;
  prtStartExpDate: boolean;
  contact: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  phone1: string;
  fedTaxNumber: string;
}

function AdvancedMode({
  lookups,
  onResult,
}: {
  lookups: Lookups | null;
  onResult: (r: CreateResult) => void;
}) {
  const [form, setForm] = useState<AdvancedFormState>({
    agencyNumber: "",
    name: "",
    agencyTypeId: 4, // Pierce default — Financial Aid
    tenderCode: 12, // A/R CHARGE
    creditLimit: "",
    statementCodeId: 6, // Month End
    nonMerchOptId: 2, // All Non-Merch
    fAccessibleOnline: false,
    fInvoiceInAR: true,
    fPrintBalance: false,
    prtStartExpDate: false,
    contact: "",
    address: "",
    city: "",
    state: "",
    postalCode: "",
    phone1: "",
    fedTaxNumber: "",
  });
  const [showAddress, setShowAddress] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const formValid = useMemo(() => {
    return (
      form.agencyNumber.trim().length > 0 &&
      form.name.trim().length > 0 &&
      form.agencyTypeId > 0
    );
  }, [form]);

  function update<K extends keyof AdvancedFormState>(
    key: K,
    value: AdvancedFormState[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function submit() {
    if (!formValid) return;
    if (
      !window.confirm(
        `Create new account "${form.agencyNumber}" with these values?\n\n` +
          `This writes to Prism and pushes to the registers.`,
      )
    ) {
      return;
    }
    setSubmitting(true);
    try {
      const creditLimit = form.creditLimit ? Number(form.creditLimit) : 0;
      const payload = {
        agencyNumber: form.agencyNumber.trim(),
        name: form.name.trim(),
        agencyTypeId: form.agencyTypeId,
        tenderCode: form.tenderCode,
        creditLimit,
        statementCodeId: form.statementCodeId,
        nonMerchOptId: form.nonMerchOptId,
        fAccessibleOnline: form.fAccessibleOnline ? 1 : 0,
        fInvoiceInAR: form.fInvoiceInAR ? 1 : 0,
        fPrintBalance: form.fPrintBalance ? 1 : 0,
        prtStartExpDate: form.prtStartExpDate ? 1 : 0,
        contact: form.contact.trim() || null,
        address: form.address.trim() || null,
        city: form.city.trim() || null,
        state: form.state.trim() || null,
        postalCode: form.postalCode.trim() || null,
        phone1: form.phone1.trim() || null,
        fedTaxNumber: form.fedTaxNumber.trim() || null,
      };
      const res = await fetch("/api/agencies/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await res.json()) as CreateResult & { error?: string };
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      toast.success(`Created ${body.newAgencyNumber}`);
      onResult(body);
    } catch (err) {
      toast.error("Create failed", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="adv-agency-number">Account Code *</Label>
          <Input
            id="adv-agency-number"
            placeholder="e.g. PSP26ANTHRODEPT"
            value={form.agencyNumber}
            onChange={(e) => update("agencyNumber", e.target.value.toUpperCase())}
            maxLength={26}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="adv-name">Account Name *</Label>
          <Input
            id="adv-name"
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            maxLength={80}
          />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor="adv-type">Account Type *</Label>
          <select
            id="adv-type"
            className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
            value={form.agencyTypeId}
            onChange={(e) => update("agencyTypeId", Number(e.target.value))}
          >
            {lookups?.agencyTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.id}: {t.description}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="adv-tender">Tender Code</Label>
          <select
            id="adv-tender"
            className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
            value={form.tenderCode ?? 12}
            onChange={(e) => update("tenderCode", Number(e.target.value))}
          >
            {lookups?.tenderCodes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.id}: {t.description}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="adv-statement">Statement Code</Label>
          <select
            id="adv-statement"
            className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
            value={form.statementCodeId ?? 6}
            onChange={(e) => update("statementCodeId", Number(e.target.value))}
          >
            {lookups?.statementCodes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.id}: {s.description}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="adv-credit">Credit Limit ($)</Label>
          <Input
            id="adv-credit"
            type="number"
            min="0"
            placeholder="0 = unlimited"
            value={form.creditLimit}
            onChange={(e) => update("creditLimit", e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="adv-nonmerch">Non-Merch Option</Label>
          <select
            id="adv-nonmerch"
            className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
            value={form.nonMerchOptId ?? 2}
            onChange={(e) => update("nonMerchOptId", Number(e.target.value))}
          >
            {lookups?.nonMerchOpts.map((o) => (
              <option key={o.id} value={o.id}>
                {o.id}: {o.description}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs uppercase">Behavior flags</Label>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <FlagRow
            id="adv-online"
            label="Accessible online"
            checked={form.fAccessibleOnline}
            onChange={(v) => update("fAccessibleOnline", v)}
          />
          <FlagRow
            id="adv-arbillable"
            label="Invoice in AR"
            checked={form.fInvoiceInAR}
            onChange={(v) => update("fInvoiceInAR", v)}
          />
          <FlagRow
            id="adv-printbal"
            label="Print balance"
            checked={form.fPrintBalance}
            onChange={(v) => update("fPrintBalance", v)}
          />
          <FlagRow
            id="adv-startexp"
            label="Print start/exp dates"
            checked={form.prtStartExpDate}
            onChange={(v) => update("prtStartExpDate", v)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <button
          type="button"
          className="text-primary text-sm font-medium hover:underline"
          onClick={() => setShowAddress((s) => !s)}
        >
          {showAddress ? "Hide" : "Show"} address & contact (optional)
        </button>
        {showAddress && (
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="adv-contact">Contact</Label>
              <Input
                id="adv-contact"
                value={form.contact}
                onChange={(e) => update("contact", e.target.value)}
                maxLength={80}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="adv-fedtax">Federal Tax Number</Label>
              <Input
                id="adv-fedtax"
                value={form.fedTaxNumber}
                onChange={(e) => update("fedTaxNumber", e.target.value)}
                maxLength={15}
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label htmlFor="adv-address">Address</Label>
              <Input
                id="adv-address"
                value={form.address}
                onChange={(e) => update("address", e.target.value)}
                maxLength={80}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="adv-city">City</Label>
              <Input
                id="adv-city"
                value={form.city}
                onChange={(e) => update("city", e.target.value)}
                maxLength={80}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="adv-state">State</Label>
              <Input
                id="adv-state"
                value={form.state}
                onChange={(e) => update("state", e.target.value)}
                maxLength={80}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="adv-postal">Postal Code</Label>
              <Input
                id="adv-postal"
                value={form.postalCode}
                onChange={(e) => update("postalCode", e.target.value)}
                maxLength={20}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="adv-phone1">Phone</Label>
              <Input
                id="adv-phone1"
                value={form.phone1}
                onChange={(e) => update("phone1", e.target.value)}
                maxLength={20}
              />
            </div>
          </div>
        )}
      </div>

      <Button onClick={submit} disabled={!formValid || submitting}>
        {submitting ? "Creating…" : "Create account"}
      </Button>
    </div>
  );
}

function FlagRow({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-center gap-2 text-sm">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(v) => onChange(Boolean(v))}
      />
      <span>{label}</span>
    </label>
  );
}
