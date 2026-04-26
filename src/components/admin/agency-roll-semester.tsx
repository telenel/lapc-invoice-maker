"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PIERCE_SEMESTER_REGEX } from "@/domains/agency/types";
import type { RollPlanRow, RollSemesterPlan } from "@/domains/agency/types";

interface SemesterSummary {
  prefix: string;
  agencyCount: number;
}

interface RollResult {
  sourceSemester: string;
  targetSemester: string;
  created: Array<{
    sourceAgencyId: number;
    sourceAgencyNumber: string;
    newAgencyId: number;
    newAgencyNumber: string;
  }>;
  skipped: Array<{
    sourceAgencyNumber: string;
    targetAgencyNumber: string;
    reason: "already_exists" | "deselected";
  }>;
  errors: Array<{ sourceAgencyNumber: string; error: string }>;
}

export function AgencyRollSemester() {
  const [semesters, setSemesters] = useState<SemesterSummary[]>([]);
  const [semestersLoading, setSemestersLoading] = useState(true);
  const [source, setSource] = useState("");
  const [target, setTarget] = useState("");
  const [plan, setPlan] = useState<RollSemesterPlan | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [rolling, setRolling] = useState(false);
  const [result, setResult] = useState<RollResult | null>(null);

  const fetchSemesters = useCallback(async () => {
    try {
      const res = await fetch("/api/agencies/semesters");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { semesters: SemesterSummary[] };
      setSemesters(data.semesters);
    } catch (err) {
      toast.error("Failed to load semester list", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSemestersLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSemesters();
  }, [fetchSemesters]);

  const sourceValid = PIERCE_SEMESTER_REGEX.test(source);
  const targetValid = PIERCE_SEMESTER_REGEX.test(target);
  const semestersValidPair = sourceValid && targetValid && source !== target;

  async function loadPlan() {
    if (!semestersValidPair) {
      toast.error("Invalid semesters", {
        description: "Source and target must each match P + (SP|FA|SU|WI) + YY and differ.",
      });
      return;
    }
    setPlanLoading(true);
    setPlan(null);
    setResult(null);
    try {
      const url = `/api/agencies/preview-roll?source=${encodeURIComponent(source)}&target=${encodeURIComponent(target)}`;
      const res = await fetch(url);
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as RollSemesterPlan;
      setPlan(data);
      // default selection: every row that doesn't already exist
      setSelectedIds(
        new Set(
          data.rows.filter((r) => !r.alreadyExists).map((r) => r.source.agencyId),
        ),
      );
    } catch (err) {
      toast.error("Failed to load preview", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setPlanLoading(false);
    }
  }

  async function executeRoll() {
    if (!plan || selectedIds.size === 0) return;
    if (
      !window.confirm(
        `Roll ${selectedIds.size} ${plan.sourceSemester} agencies forward to ${plan.targetSemester}?\n\n` +
          `This writes to Prism. Each clone runs SP_ARAcctResendToPos to push to the registers.`,
      )
    ) {
      return;
    }
    setRolling(true);
    try {
      const res = await fetch("/api/agencies/roll-semester", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: plan.sourceSemester,
          target: plan.targetSemester,
          selectedSourceAgencyIds: Array.from(selectedIds),
        }),
      });
      const body = (await res.json()) as RollResult & { error?: string };
      if (!res.ok) {
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      setResult(body);
      if (body.errors.length > 0) {
        toast.error(`${body.created.length} created, ${body.errors.length} errored`);
      } else {
        toast.success(
          `Created ${body.created.length} agencies in ${plan.targetSemester}.`,
        );
      }
      // Update the existing plan in-place so newly-created targets show as
      // "Already exists" in the table. Re-fetching loadPlan() would clobber
      // the result panel since loadPlan resets `result` to null.
      const createdSourceIds = new Set(body.created.map((c) => c.sourceAgencyId));
      setPlan((prev) =>
        prev
          ? {
              ...prev,
              rows: prev.rows.map((row) =>
                createdSourceIds.has(row.source.agencyId)
                  ? { ...row, alreadyExists: true }
                  : row,
              ),
            }
          : prev,
      );
      // Deselect the rows we just created so the count badge reflects work remaining.
      setSelectedIds((prev) => {
        const next = new Set(prev);
        body.created.forEach((c) => next.delete(c.sourceAgencyId));
        return next;
      });
    } catch (err) {
      toast.error("Rollover failed", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setRolling(false);
    }
  }

  const eligibleRows = useMemo(
    () => plan?.rows.filter((r) => !r.alreadyExists) ?? [],
    [plan],
  );
  const allEligibleSelected =
    eligibleRows.length > 0 &&
    eligibleRows.every((r) => selectedIds.has(r.source.agencyId));

  function toggleAllEligible() {
    if (allEligibleSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(eligibleRows.map((r) => r.source.agencyId)));
    }
  }

  function toggleRow(agencyId: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(agencyId)) next.delete(agencyId);
      else next.add(agencyId);
      return next;
    });
  }

  return (
    <div className="container mx-auto space-y-6 py-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Pierce semester rollover</h1>
          <p className="text-muted-foreground text-sm">
            Clone all of one semester&apos;s AR agencies into a new semester.
            Replaces the manual WPAdmin Account Maintenance workflow.
          </p>
        </div>
        <a
          href="/admin/agencies/new"
          className="text-primary text-sm font-medium hover:underline"
        >
          Add a single account →
        </a>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>1. Pick semesters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="source-semester">Source semester</Label>
              <Input
                id="source-semester"
                placeholder="e.g. PWI25"
                value={source}
                onChange={(e) => setSource(e.target.value.toUpperCase())}
                aria-invalid={source !== "" && !sourceValid}
                list="semester-options"
              />
              <datalist id="semester-options">
                {semesters.map((s) => (
                  <option key={s.prefix} value={s.prefix}>
                    {s.prefix} ({s.agencyCount} agencies)
                  </option>
                ))}
              </datalist>
            </div>
            <div className="space-y-2">
              <Label htmlFor="target-semester">Target semester</Label>
              <Input
                id="target-semester"
                placeholder="e.g. PWI26"
                value={target}
                onChange={(e) => setTarget(e.target.value.toUpperCase())}
                aria-invalid={target !== "" && !targetValid}
              />
            </div>
          </div>
          <div className="text-muted-foreground text-xs">
            {semestersLoading
              ? "Loading existing semesters…"
              : `${semesters.length} Pierce semesters present in Prism. Most recent: ${semesters
                  .slice(0, 5)
                  .map((s) => s.prefix)
                  .join(", ")}`}
          </div>
          <Button onClick={loadPlan} disabled={!semestersValidPair || planLoading}>
            {planLoading ? "Loading…" : "Find agencies"}
          </Button>
        </CardContent>
      </Card>

      {plan && (
        <Card>
          <CardHeader>
            <CardTitle>
              2. Review {plan.sourceSemester} → {plan.targetSemester}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm">
              Found <strong>{plan.rows.length}</strong> {plan.sourceSemester} agencies.{" "}
              <strong>{plan.rows.filter((r) => r.alreadyExists).length}</strong> already
              exist in {plan.targetSemester}.
            </div>

            {plan.rows.length === 0 ? (
              <div className="text-muted-foreground text-sm">
                No source agencies match the prefix &quot;{plan.sourceSemester}&quot;.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={allEligibleSelected}
                        onCheckedChange={toggleAllEligible}
                        aria-label="Select all eligible"
                      />
                    </TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead className="text-right">Type</TableHead>
                    <TableHead className="text-right">Credit</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {plan.rows.map((row: RollPlanRow) => (
                    <TableRow key={row.source.agencyId}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(row.source.agencyId)}
                          onCheckedChange={() => toggleRow(row.source.agencyId)}
                          disabled={row.alreadyExists}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {row.source.agencyNumber}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {row.targetAgencyNumber}
                      </TableCell>
                      <TableCell className="text-right">
                        {row.source.agencyTypeId}
                      </TableCell>
                      <TableCell className="text-right">
                        {row.source.creditLimit > 0
                          ? `$${row.source.creditLimit.toLocaleString()}`
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {row.alreadyExists ? (
                          <Badge variant="secondary">Already exists</Badge>
                        ) : (
                          <Badge>Eligible</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            <div className="flex items-center gap-3">
              <Button
                onClick={executeRoll}
                disabled={selectedIds.size === 0 || rolling}
              >
                {rolling ? "Rolling…" : `Roll forward ${selectedIds.size} agencies`}
              </Button>
              <span className="text-muted-foreground text-xs">
                Each clone writes to Prism and pushes to the registers via{" "}
                <code className="text-xs">SP_ARAcctResendToPos</code>.
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>3. Result</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              Created <strong>{result.created.length}</strong>, skipped{" "}
              <strong>{result.skipped.length}</strong>, errored{" "}
              <strong>{result.errors.length}</strong>.
            </div>
            {result.created.length > 0 && (
              <details className="space-y-1">
                <summary className="cursor-pointer font-medium">
                  Created ({result.created.length})
                </summary>
                <ul className="text-muted-foreground ml-4 list-disc font-mono text-xs">
                  {result.created.map((row) => (
                    <li key={row.newAgencyId}>
                      {row.sourceAgencyNumber} → {row.newAgencyNumber} (AgencyID{" "}
                      {row.newAgencyId})
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {result.errors.length > 0 && (
              <details open className="space-y-1">
                <summary className="text-destructive cursor-pointer font-medium">
                  Errors ({result.errors.length})
                </summary>
                <ul className="text-destructive ml-4 list-disc text-xs">
                  {result.errors.map((row, i) => (
                    <li key={i}>
                      <span className="font-mono">{row.sourceAgencyNumber}</span>:{" "}
                      {row.error}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
