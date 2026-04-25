# WinPRISM static analysis — binary string extraction

Companion to the dynamic-analysis log at [`../winprism-reverse-engineering.md`](../winprism-reverse-engineering.md). Where dynamic analysis observes what the WPAdmin client _does_ (snapshot the DB before, click a button, snapshot after, diff), static analysis reads what the client _can_ do by extracting embedded SQL, stored-proc names, view names, and UI message strings directly out of the compiled binaries.

The two approaches answer different questions:

| Question | Approach |
|---|---|
| "What did clicking _Save_ on the Item screen actually write?" | Dynamic — diff a snapshot pair |
| "What's the full universe of writes ItemMnt.dll _could_ perform?" | Static — read the binary's embedded SQL |
| "Which proc does WPAdmin call when you discontinue an item?" | Dynamic gives proof; static gives candidates |
| "Which tables does the AR module touch at all?" | Static — by-table index |

Use them together. Static narrows the search space; dynamic confirms the actual call sequence.

## What's in this folder

```
docs/prism/static/
├─ README.md         ← this file
├─ catalog.md        — per-binary summary table (statements, tables, procs, views)
├─ catalog.json      — full machine-readable inventory (consumed by future tooling)
├─ by-table.md       — table → binaries that touch it, with INSERT/UPDATE/DELETE/SELECT split
├─ by-proc.md        — stored proc → binaries that call it
├─ by-view.md        — view → binaries that query it
├─ actions/
│  ├─ README.md      — per-action analysis pattern
│  └─ <verb>-<scope>.md  — what static analysis tells us about a specific WPAdmin action
├─ binaries/
│  └─ <binary>.md    — per-binary deep-dive: write surface, read surface, procs, views, raw SQL
└─ ../strings/
   ├─ <binary>.strings.txt   — every printable string ≥6 chars (ASCII + UTF-16LE)
   ├─ <binary>.sql.txt       — pre-filtered to SQL-keyword-bearing lines
   └─ <binary>.procs.txt     — pre-filtered to standalone proc-name strings
```

The `strings/` folder lives one level up because it's the raw extraction (a verbatim dump from the binaries, not analysis output). Treat it as the regenerable substrate.

## How the extraction works

WPAdmin and the WinPRISM module DLLs are 32-bit native C++ binaries (confirmed via `scripts/prism-probe-clr.ps1` — only 4 small Crystal Reports helpers are .NET, see [Binary inventory](#binary-inventory) below). Native binaries embed string literals — including SQL statements and stored proc names — as plain bytes inside the `.rdata` section. We extract them in two encodings:

1. **ASCII runs** — sequences of printable bytes in `[0x20, 0x7E]` of length ≥ 6.
2. **UTF-16LE runs** — same, but treating every other byte as a high byte that must be 0.

The combined set is deduplicated and saved per-binary. Then `prism-analyze-binaries.ts` parses the strings file and classifies each line:

- **SQL statements** — `INSERT INTO`, `UPDATE`, `DELETE FROM`, `SELECT`, `EXEC`, `MERGE` are recognized; the primary table, joined tables, projected columns (when present), referenced views, and `%d`/`%s` parameter placeholders are extracted.
- **Stored procs** — names matching common Prism prefixes (`SP_`, `sp_`, `fn_`, `E_`, `P_`, `CMD_`, `NB_`, etc.) are flagged as standalone proc references; these usually come from ODBC `{call name(?,?)}` invocations where the proc name is the only piece visible to the strings extractor.
- **Views** — names starting with `VW_` or `V_` are flagged.
- **UI messages** — English-looking sentences are sampled to hint at user-facing features.

## Binary inventory

`scripts/prism-probe-clr.ps1` classified every `.exe` and `.dll` under `C:\Program Files (x86)\WinPRISM\`. Of 46 files: **42 native, 4 .NET**.

The 17 binaries currently in the analysis catalog are the WinPRISM core modules (everything excluding installers, redistributables, and Crystal Reports / Genericom support DLLs):

```
WinPrism.exe       Main client app (POS + back-office shell)
WPAdmin.exe        Back-office admin shell
ItemMnt.dll        Item maintenance (add / edit / discontinue / barcode / VERBA / styles)
VendMnt.dll        Vendor maintenance
WPInv.dll          Inventory operations
WPBuyBack.dll      Buyback workflow
WPComm.dll         Communication / sync
WPCredit.dll       Credit handling
WPData.dll         Thin data-layer wrapper (mostly stubs)
WPPdt.dll          PDT (handheld) integration (very small)
WPPosCmn.dll       POS shared subroutines
WPTender.dll       Tender / payment handling
WPUtility.dll      Utility / data-access (the largest auxiliary module)
WA_AP.dll          Accounts Payable
WA_AR.dll          Accounts Receivable
WA_GL.dll          General Ledger
WACommon.dll       Accounting common
```

The 4 .NET assemblies (`CampusHub.WebPrism.Cryptography`, `CRUFL_NBC_Addin`, `NBC.CrystalReport`, `NBC.Utility`) are reportable via decompilation (dnSpy / ILSpy) but are not in scope for this static pass.

## Headline findings (initial pass)

- **WPAdmin is a shell, not a data layer.** The bulk of write logic lives in the per-domain DLLs. The `*Mnt.dll` modules and `WPUtility.dll` carry most of the actual SQL.
- **ItemMnt.dll has 207 parsed statements**, including direct `INSERT` / `UPDATE` / `DELETE` against `Item_Xref`, `Inventory_NonMerch`, `OnHold`, `Price_Change_Table`, `VERBA_Import`, `Matrix_Attrib_Order`, and 8 distinct `EXEC` calls into `E_*` procs (style template management, cost cascades).
- **Most stored proc usage is via ODBC call syntax**, not literal `EXEC` statements. The proc list pulled from each binary is a lower bound — many real calls only show up as bare proc-name strings.
- **There is heavy use of `VW_*` views** for reads, especially in WPUtility, WPBuyBack, and WinPrism — 42, 21, and 63 distinct views respectively.
- **Case inconsistency in the embedded SQL.** Some statements reference `Item` while others reference `item`; same for `Inventory`, `current`, and others. SQL Server is case-insensitive by collation, but the tables are listed both ways in the catalog because the analyzer keys on the raw casing. Treat `Item` and `item` as the same table.

## Limitations

- **Case-folding not applied.** A future analyzer pass should normalize table names to their canonical casing (e.g. always `Item`, never `item`).
- **Proc filter is heuristic.** A few false positives slip through (e.g. `RoyaltyCost` listed as a proc when it appears to be a column name). The standalone-string filter is permissive; verify against the schema map before trusting.
- **No call-graph reconstruction.** Static strings do not tell us which proc/SQL belongs to which UI button. Pair with dynamic-analysis snapshot/diff to confirm a specific action's call sequence.
- **Composed SQL is invisible.** When the client builds a statement piecewise (e.g. `"UPDATE " + tableName + " SET ..."`), the binary holds only the fragments. We see the keywords, but the table identity is lost.
- **Encrypted procs are opaque.** SCHEMA.md notes 2 encrypted procs; static analysis can see them being called but cannot inspect their bodies.

## Regenerating

```bash
# 1. Re-extract strings from the binaries (PowerShell, takes ~10 s)
powershell.exe -ExecutionPolicy Bypass -File scripts/prism-extract-strings.ps1

# 2. Re-build the structured catalog (TypeScript, takes ~1 s)
npx tsx scripts/prism-analyze-binaries.ts
```

Both scripts are pure local file I/O — they do not touch the WinPRISM SQL Server.

## Companion: plan-cache method

Static-only analysis hits a hard limit when a binary's literal SQL is just a stored-proc call: the proc body is opaque because `pdt` lacks `VIEW DEFINITION`. **The plan-cache method** ([`plan-cache-method.md`](plan-cache-method.md)) sidesteps this by reading executed statements out of `sys.dm_exec_query_stats`, indexed by their containing proc. Recovers a proc body in seconds. Recovered bodies live in [`proc-bodies/`](proc-bodies/).

Together, the three RE tracks now cover:
- **Static binary strings** → which proc does WPAdmin call?
- **Plan-cache recovery** → what does that proc actually do, statement by statement?
- **Dynamic snapshot/diff** → what trigger residue / audit / side effects fire around it?

## Cross-references

- [`../winprism-reverse-engineering.md`](../winprism-reverse-engineering.md) — dynamic-analysis log, the canonical "what does this button actually write" record.
- [`../SCHEMA.md`](../SCHEMA.md) — full Prism schema reference (962 tables, 4654 procs, 1472 views).
- [`../field-usage.md`](../field-usage.md) — Pierce-only column population stats; tells you which fields are real-world hot vs cold.
- [`../tooling.md`](../tooling.md) — catalog of every prism-related script in this repo.
- [`plan-cache-method.md`](plan-cache-method.md) — companion reverse-engineering technique using SQL Server's plan cache.
- [`proc-bodies/`](proc-bodies/) — recovered Prism stored-procedure bodies.
