# Action: Clone an AR agency from a previous-semester template

**The problem:** Pierce maintains hundreds of AR agencies that recur each semester — `EOPSDEPT`, `USVET`, `ASO`, `UMOJA`, `BUSOFF`, `DRC`, `ATHL`, `MULTI`, etc. Every term, the staff has to re-create them in WPAdmin's Account Maintenance form, picking the previous semester's instance as a "mirror" template. With ~50 templates × 4 semesters/year, that's 150–200 manual creates per year. This doc maps the cloning pattern and proposes a laportal automation.

**Companion to:**
- [`create-ar-agency.md`](create-ar-agency.md) — `Acct_Agency` schema + empirical Pierce-default INSERT contract.
- [`agency-binary-findings.md`](agency-binary-findings.md) — **2026-04-25 update**: literal MFC column list + verified proc signatures recovered from binaries.

**Method:** Empirical analysis via [`scripts/probe-prism-agency-cloning.ts`](../../../../scripts/probe-prism-agency-cloning.ts) — read-only queries against `Acct_Agency` and its sibling tables. No writes.

## TL;DR

- Pierce's semester naming convention is **4 prefixes × 2-digit year × suffix**: `PSP26EOPSDEPT` = Pierce Spring 2026 EOPS Department.
- **57 distinct semester groups** are present across 14+ years of data. The recent active set: PSP26 (44 agencies), PWI26 (17), PSP25 (71), PWI25 (47), PSU25 (17), PFA25 (in-progress). Each spring/fall semester has 50–70 agencies; winter/summer have 15–50.
- For any recurring template (e.g. `EOPSDEPT`), **almost every column is identical across semester instances**. Only `AgencyNumber`, `Name`, and a few amount/flag fields legitimately vary.
- **The companion procs `SP_AcctAgencyCopyDCC` and `SP_AcctAgencyCopyNonMerch` haven't been recently executed** — Pierce currently does not use WPAdmin's built-in copy buttons. The "mirror from existing" workflow Marcos described is a manual field-by-field re-entry in the form.
- **For most Pierce templates, `Acct_Agency_DCC` and `Acct_Agency_NonMerch` are empty anyway** — there's nothing meaningful to copy from those secondary tables. The clone is essentially `Acct_Agency` row only.
- **Customer linkages do not roll forward.** Each semester gets its own fresh batch of student `Acct_Agency_Customer` rows (~400 per EOPS-family agency).

This means the laportal automation can be very simple: **one INSERT per template, change `AgencyNumber` and `Name`, leave the rest alone, optionally clone the (usually empty) secondary rows, then call `SP_ARAcctResendToPos` to push to the registers**. A single-button "roll PWI25 forward to PWI26" feature is achievable and would replace 50+ manual form-fills with one click.

## 1. Pierce's semester naming convention

`AgencyNumber` is `char(26)`. Pierce uses a structured format:

| Position | Meaning | Values seen |
|---|---|---|
| 1 | School | `P` (Pierce) |
| 2–3 | Semester | `SP` (Spring), `FA` (Fall), `SU` (Summer), `WI` (Winter) |
| 4–5 | Year (2-digit) | `11`–`26` |
| 6+ | Suffix (the "template") | `EOPSDEPT`, `USVET`, `ASO`, `UMOJA`, `ATHL`, ... |

Example: `PSP26EOPSDEPT` = Pierce / Spring / 2026 / EOPS Department template.

A small number of older agencies use a single-letter season (`PW14EOPS`, `PSU13EOPS`) instead of the two-letter form. Newer ones consistently use the two-letter convention.

### Semester volumes (most recent)

| Semester | Agencies created |
|---|---:|
| PSP25 | 71 |
| PSP24 | 62 |
| PSP23 | 64 |
| PWI25 | 47 |
| PSP26 | 44 |
| PWI24 | 41 |
| PSU23 | 45 |
| PWI26 | 17 (in-progress) |
| PSU25 | 17 |

A typical semester roll-forward at Pierce involves cloning **40–70 agencies** (Spring/Fall) or **15–50 agencies** (Winter/Summer).

## 2. Recurring template anatomy — `EOPSDEPT` as canonical example

Pulling all 94 `Acct_Agency` rows whose `AgencyNumber` matches `P%EOPS%`, sorted newest first:

| AgencyID | AgencyNumber | Name | AgencyTypeID | CreditLimit | TenderCode | fSetCredLimit | fAccessibleOnline |
|---:|---|---|---:|---:|---:|---:|---:|
| 13488 | PWI26EOPSDEPT | `PWI26EOPSDEPT` | 2 | 0 | 12 | 0 | 0 |
| 11599 | PWI25EOPS | `PWI25EOPS` | 2 | 0 | 12 | 0 | 0 |
| 10364 | PWI24EOPS | `PWI24EOPS` | 2 | 0 | 12 | 0 | 0 |
| 8743 | PWI23EOPSDEPT | `PIERCE WINTER 2023 EOPS DEPARTMENT` | **4** | 0 | 12 | 0 | 0 |
| 8512 | PWI23EOPS | `PIERCE 2023 WINTER EOPS GRANT` | **4** | **500** | **49** | **1** | **1** |
| 6679 | PWI21EOPS | `PIERCE WINTER 2021EOPS GRANT` | 4 | 400 | 49 | 1 | 1 |
| 12664 | PSU25EOPSDEPT | `PSU25EOPSDEPT` | 4 | 0 | 12 | 0 | 0 |
| 12570 | PSU25EOPSBK | `PSU25EOPSBK` | 4 | 200 | 49 | 1 | 1 |
| 12566 | PSU25EOPSMEALJUNE | `PSU25EOPSMEALJUNE` | 4 | 100 | 49 | 1 | 1 |
| 12567 | PSU25EOPSMEALJULY | `PSU25EOPSMEALJULY` | 4 | 100 | 49 | 1 | 1 |
| 12568 | PSU25EOPSMEALAUGUST | `PSU25EOPSMEALAUGUST` | 4 | 100 | 49 | 1 | 1 |
| 13602 | PSP26EOPSMEALFEB | `PSP26EOPSMEALFEB` | 4 | 50 | 12 | 1 | 0 |
| 13603 | PSP26EOPSMEALMAR | `PSP26EOPSMEALMAR` | 4 | 50 | 12 | 1 | 0 |
| 13604 | PSP26EOPSMEALAPR | `PSP26EOPSMEALAPR` | 4 | 50 | 12 | 1 | 0 |
| 13605 | PSP26EOPSMEALMAY | `PSP26EOPSMEALMAY` | 4 | 50 | 12 | 1 | 0 |

### What this tells us

**Three distinct sub-templates** under the EOPS family:

| Sub-template | Convention | TenderCode | CreditLimit | fSetCredLimit | fAccessibleOnline | Notes |
|---|---|---:|---:|---:|---:|---|
| `EOPSDEPT` (regular) | Department charging | 12 | 0 | 0 | 0 | The standard "no credit cap" department account |
| `EOPSGRANT` / `EOPSBK` | Grant book voucher | 49 | $200–$500 | 1 | 1 | Bookstore grant program |
| `EOPSMEALxxx` | Per-month meal grant | 12 or 49 | $50–$100 | 1 | varies | Monthly meal-grant accounts (FEB/MAR/APR/MAY/JUNE/JULY/AUGUST) |

**These sub-templates are stable across years.** The 2024 grant variant has `CreditLimit=400`; the 2023 variant has `CreditLimit=500`; the 2021 variant has `CreditLimit=400`. Credit limit drifts year to year (presumably tracking the actual grant program's funding), but the structural pattern is identical.

**Across all 94 EOPS-family rows, the following columns are universally identical:**
```
StatementCodeID = 6
DiscountCodeID  = 0
ChangeLimit     = 0
MimimumCharge   = 0
FinanceRate     = 0
MaxDays         = 30
NonMerchOptID   = 2
HalfReceiptTemplateID  = 0
FullReceiptTemplateID  = 0
fTaxExempt      = 0
fBalanceType    = 1
fBilling        = 1
fStatus         = 0
fDebit          = 0
fInvoiceInAR    = 1 (mostly — 2 anomalies)
fPrintBalance   = 0
PrtStartExpDate = 0
TextbookValidation     = 0
ValidateTextbooksOnly  = 0
Address, City, State, PostalCode, Phone1, Contact = NULL
```

These match the **Pierce-default INSERT template** documented in [`create-ar-agency.md`](create-ar-agency.md) §6 — the empirical Pierce defaults derived from sampling 1,072 PSP-prefixed agencies.

### What varies legitimately

| Field | Purpose | Driver |
|---|---|---|
| `AgencyNumber` | Identity | Compute from semester + suffix |
| `Name` | Display | Mirror or derive (modern agencies = AgencyNumber, older = verbose) |
| `AgencyTypeID` | 2 (Department) vs 4 (Grant variant) | Inherited from sub-template |
| `CreditLimit` | $0–$500 | Sub-template + per-program funding |
| `TenderCode` | 12 (regular) vs 49 (grant) | Inherited from sub-template |
| `fSetCredLimit` | 0 vs 1 | Set when CreditLimit > 0 |
| `fAccessibleOnline` | 0 vs 1 | Sub-template-driven |

For roll-forward, all of these should be **inherited from the source agency unchanged**. The user doesn't need to re-decide; the previous semester's values are right.

## 3. Acct_Agency_Customer (student linkages) — does NOT roll forward

For the 94 EOPS-family agencies, there are **37,610 `Acct_Agency_Customer` rows** — averaging ~400 students per agency. These represent individual students authorized to charge against the agency in a given semester window.

Sample for `PWI21EOPS` (AgencyID 6679):
- 400+ rows, all with `StartDate` 2020-12-16 and `ExpDate` 2021-01-14 (a 4-week winter session window)
- `CreditLimit` per student = 100
- `fStatus = 1` (active)

**These rows are semester-specific by design.** When a new semester is rolled forward, EOPS staff will re-link a fresh batch of students. The clone operation should NOT copy these.

## 4. Acct_Agency_DCC and Acct_Agency_NonMerch — usually empty

For the 94 EOPS-family agencies:
- `Acct_Agency_DCC`: 102 rows, but most agencies have zero rows (the LEFT JOIN returns NULL). Pierce does not restrict EOPS accounts to specific Department/Class/Category codes.
- `Acct_Agency_NonMerch`: 0 actual rows. No non-merch fee codes configured.

**For EOPS-family agencies, neither `SP_AcctAgencyCopyDCC` nor `SP_AcctAgencyCopyNonMerch` would have anything to copy.** For other templates that do have DCC/NonMerch rows, the procs would clone them — but at Pierce, this is rare.

## 5. Companion procs — exist but Pierce isn't using them

`sys.dm_exec_procedure_stats` shows:

- `SP_AcctAgencyCopyDCC` — **0 cached executions**
- `SP_AcctAgencyCopyNonMerch` — **0 cached executions**
- `SP_GetAgencyName` — 61 executions (read-only lookup)
- `SP_POS_TendTotalApplyAgencyDiscount` — 32 executions (POS-side runtime)
- `SP_POS_GetAgencyDiscount` — 6 executions

The "Copy from previous account" workflow in WPAdmin's Account Maintenance form is **not invoking the dedicated copy procs**. Either it does its own field-by-field copy via the form (likely), or it's not used at all and Pierce staff manually retype.

This means the laportal automation **doesn't need to call the WPAdmin copy procs** — it can do its own clone via direct INSERT.

## 6. The clone SQL

For a single template clone (e.g., `PSP25EOPSDEPT` → `PSP26EOPSDEPT`):

```sql
-- 1. Insert the cloned Acct_Agency row
INSERT INTO Acct_Agency (
    -- Identity
    AgencyNumber, Name,
    -- Inherited from source (DO NOT CHANGE)
    AgencyTypeID, StatementCodeID, AcctTermID, DiscountCodeID,
    ChangeLimit, CreditLimit, MimimumCharge, FinanceRate,
    MaxDays, TenderCode, NonMerchOptID,
    HalfReceiptTemplateID, FullReceiptTemplateID,
    fTaxExempt, fBalanceType, fBilling, fSetCredLimit, fStatus,
    fDebit, fFinanceType, fFinanceCharge, fPageBreak, fPermitChgDue,
    fOpenDrawer, fRefRequired, fAccessibleOnline, fAllowLimitChg,
    fInvoiceInAR, fPrintBalance, fDispCustCmnt, fPrtCustCmnt,
    PrtStartExpDate, TextbookValidation, ValidateTextbooksOnly,
    DiscountType, PrintInvoice,
    -- Optional inherited
    Contact, Address, City, State, Country, PostalCode,
    Phone1, Phone2, Phone3, Ext1, Ext2, Ext3,
    txComment, FedTaxNumber, AgencyBillingID, Priority
)
SELECT
    @new_agency_number, @new_name,
    AgencyTypeID, StatementCodeID, AcctTermID, DiscountCodeID,
    ChangeLimit, CreditLimit, MimimumCharge, FinanceRate,
    MaxDays, TenderCode, NonMerchOptID,
    HalfReceiptTemplateID, FullReceiptTemplateID,
    fTaxExempt, fBalanceType, fBilling, fSetCredLimit, fStatus,
    fDebit, fFinanceType, fFinanceCharge, fPageBreak, fPermitChgDue,
    fOpenDrawer, fRefRequired, fAccessibleOnline, fAllowLimitChg,
    fInvoiceInAR, fPrintBalance, fDispCustCmnt, fPrtCustCmnt,
    PrtStartExpDate, TextbookValidation, ValidateTextbooksOnly,
    DiscountType, PrintInvoice,
    Contact, Address, City, State, Country, PostalCode,
    Phone1, Phone2, Phone3, Ext1, Ext2, Ext3,
    txComment, FedTaxNumber, AgencyBillingID, Priority
FROM Acct_Agency
WHERE AgencyID = @source_agency_id;

DECLARE @new_agency_id int = SCOPE_IDENTITY();

-- 2. The TI_Acct_Agency trigger fires automatically and populates
--    Acct_Agency_Tax_Codes via Cartesian on the new AgencyID.
--    No action needed.

-- 3. Optionally clone DCC permissions (rarely populated for Pierce).
EXEC SP_AcctAgencyCopyDCC @source_agency_id, @new_agency_id;

-- 4. Optionally clone non-merch fee codes (rarely populated for Pierce).
EXEC SP_AcctAgencyCopyNonMerch @source_agency_id, @new_agency_id;

-- 5. Push to register-local POS DBs so the new agency is tenderable.
EXEC SP_ARAcctResendToPos @new_agency_id;

-- 6. Acct_Agency_Customer rows are NOT cloned; per-semester student linkage
--    is the EOPS staff's separate workflow.
```

That's the complete operation. Three INSERTs (header + 2 optional sub-tables) + 1 POS push.

## 7. Bulk semester roll-forward

The high-leverage operation is **rolling forward an entire semester at once**. Conceptually:

1. **Input**: source semester (e.g., `PWI25`), target semester (e.g., `PWI26`)
2. **Find all source agencies**: `SELECT AgencyID, AgencyNumber FROM Acct_Agency WHERE AgencyNumber LIKE 'PWI25%'` → 47 rows
3. **Compute target names**: for each source `AgencyNumber`, replace `PWI25` with `PWI26` → `PWI25EOPSDEPT` → `PWI26EOPSDEPT`
4. **Detect collisions**: any target `AgencyNumber` that already exists in `Acct_Agency`? → skip those (rolled-forward already)
5. **Preview**: show the user "47 agencies will be created, 0 will be skipped (or N skipped because already rolled)"
6. **Commit**: in one transaction, do all 47 clones using the per-template SQL above

This replaces a several-hour manual workflow with a single click.

### Edge cases to handle

- **Name update**: older agencies have verbose names like `PIERCE WINTER 2023 EOPS DEPARTMENT`. The clone could either (a) strict-mirror Source's Name (resulting in stale year refs), or (b) substitute the year in the Name string. Recommend **(b) regex-replace YY→YY+1 in the Name** so `PIERCE WINTER 2023 EOPS DEPARTMENT` → `PIERCE WINTER 2024 EOPS DEPARTMENT`. Modern terse names (Name = AgencyNumber) handle this trivially.
- **Sub-templates with multiple instances per semester**: monthly meal grants (`PSU25EOPSMEALJUNE/JULY/AUGUST`) need their own per-month clones. The bulk roll-forward handles this naturally because each month is its own row in `Acct_Agency`.
- **One-off agencies**: not every previous-semester agency needs to roll forward (some are one-time grants). Provide a "select which to roll" checkbox UI and default to selecting all.
- **Cross-semester rolls**: `PFA25` → `PSP26` (Fall to Spring) is a different shape than `PSP25` → `PSP26` (year-over-year). Pierce probably wants per-pair: usually `PSP25` → `PSP26`, `PWI25` → `PWI26`, etc.

### Suggested laportal UI

```
┌─────────────────────────────────────────────────────────────────┐
│  Roll Pierce semester forward                                    │
├─────────────────────────────────────────────────────────────────┤
│  Source semester:  PWI25  ▾                                      │
│  Target semester:  PWI26  ▾                                      │
│                                                                  │
│  [Find agencies]                                                 │
├─────────────────────────────────────────────────────────────────┤
│  Found 47 PWI25 agencies. 0 already exist in PWI26.              │
│                                                                  │
│  ☑ PWI25EOPSDEPT  →  PWI26EOPSDEPT      (Type 2, $0 limit)       │
│  ☑ PWI25EOPSGRANT →  PWI26EOPSGRANT     (Type 4, $500 limit)     │
│  ☑ PWI25USVETS    →  PWI26USVETS        (Type 2, $0 limit)       │
│  ☑ PWI25ASO       →  PWI26ASO           (Type 2, $0 limit)       │
│  ☑ PWI25UMOJA     →  PWI26UMOJA         (Type 2, $0 limit)       │
│  ... (42 more — all selected by default)                         │
│                                                                  │
│  [ Preview SQL ]   [ Roll forward 47 agencies ]                  │
└─────────────────────────────────────────────────────────────────┘
```

### Even simpler: "Roll all unrolled" button

If Pierce always rolls everything forward, even simpler:

```
┌─────────────────────────────────────────────────────────────────┐
│  Pierce semester rollover                                        │
├─────────────────────────────────────────────────────────────────┤
│  Latest semester: PSP26 (44 agencies)                            │
│  Previous comparable: PSP25 (71 agencies)                        │
│                                                                  │
│  27 PSP25 agencies have no PSP26 counterpart yet.                │
│                                                                  │
│  [ Show details ]   [ Create the 27 missing PSP26 agencies ]     │
└─────────────────────────────────────────────────────────────────┘
```

The system detects the gap automatically and one-clicks the catch-up.

## 8. Implementation in laportal

The laportal-side service layer is roughly:

```typescript
// src/domains/agency/clone.ts
async function cloneAgency(sourceAgencyId: number, newAgencyNumber: string, newName: string) {
  // 1. Read source row (the SAFE_CLONE_COLS list from the SQL above)
  // 2. Validate target AgencyNumber doesn't already exist
  // 3. Single INSERT into Acct_Agency selecting source's columns
  //    with overrides for AgencyNumber and Name
  // 4. SCOPE_IDENTITY() to get new AgencyID
  // 5. EXEC SP_AcctAgencyCopyDCC and SP_AcctAgencyCopyNonMerch
  // 6. EXEC SP_ARAcctResendToPos
  // 7. Return new AgencyID + AgencyNumber
}

async function rollSemesterForward(sourceSemester: string, targetSemester: string) {
  // 1. SELECT all Acct_Agency where AgencyNumber LIKE sourceSemester + '%'
  // 2. For each: compute new AgencyNumber by string replace
  // 3. Filter out any whose target already exists
  // 4. In one transaction: cloneAgency() each remaining
  // 5. Stamp every INSERT with the current user's PrismUser.SUID (per
  //    user-identity-mapping.md) so audit shows "Marcos Montalvo created"
  //    not "the laportal service created"
  // 6. Return summary: { created: number; skipped: number; ids: number[] }
}
```

Estimated build effort: **~1 day** for the service layer + a basic UI. The contract is fully known; no further reverse-engineering required.

### Per-user audit stamping

`Acct_Agency` has no `UserID` column directly, so the actor isn't recorded on the agency row itself. However:

- The `TI_Acct_Agency` and `TUI_Acct_Agency` triggers fire on insert — they may stamp other tables with `SUSER_NAME()` (which would show `pdt`, the laportal service login).
- `SP_ARAcctResendToPos` writes to `pos_update` — that's where audit might land for the POS sync side.

Worth a brief snapshot/diff session to confirm where audit residue actually lands when a clone runs. For now, laportal can keep its own audit log on the laportal side (see [`user-identity-mapping.md`](../../user-identity-mapping.md)) capturing `(timestamp, prism_user_suid, source_agency_id, new_agency_id)` for each clone.

## 9. What we still don't know (and why it doesn't block)

- ~~**The literal MFC `INSERT INTO Acct_Agency` from WPAdmin**~~ — **CLOSED 2026-04-25** via binary recovery. The 53-column MFC binding is in `WPData.dll`. See [`agency-binary-findings.md`](agency-binary-findings.md).
- ~~**`SP_AcctAgencyCopy*` proc signatures**~~ — **VERIFIED 2026-04-25**: `SP_AcctAgencyCopyDCC(@NewAgencyID, @OldAgencyID)` and `SP_AcctAgencyCopyNonMerch(@NewAgencyID, @OldAgencyID)` — note **NEW comes FIRST** in the parameter order.
- **What the WPAdmin form's "copy from existing" button actually does internally** — Pierce isn't reliably using it (0 cached executions of either copy proc), so cloning via direct SELECT-INSERT is appropriate.
- **`TUI_Acct_Agency` cursor body** — partial only. Pierce uses TextbookValidation=0, so the trigger's main branch likely doesn't fire.
- **`TD_Acct_Agency` (delete trigger)** — not relevant; we never delete during clone.
- ~~**`SP_ARAcctResendToPos` body**~~ — **RECOVERED 2026-04-25** ([`../proc-bodies/SP_ARAcctResendToPos.sql`](../proc-bodies/SP_ARAcctResendToPos.sql)). For a fresh clone (no `Acct_Agency_Customer` rows yet), the proc emits only type-6 `pos_update` rows — one per Location. That's the desired minimal POS sync.

## 10. Recommended next steps

1. **Build the laportal "Roll semester forward" feature.** ~1 day. Single-button UX backed by the clone SQL above.
2. **Test via dev → staging → prod with Marcos's explicit acknowledgment** for each first run. Per the read-only rule, all writes here are user-initiated, so they're permitted — but a one-off dev clone with full diff capture would prove the contract.
3. **Optionally**: build a "Pierce semester rollover" admin page that runs after every semester end. Pre-detects missing agencies, lets Stella or Michael click once to create them all.

## 11. Probe used

`scripts/probe-prism-agency-cloning.ts` — read-only. Covers:

- Pierce naming pattern detection (5-char prefix groups)
- Semester prefix + year breakdown
- Recurring template suffix discovery (40+ recurring templates)
- Per-template field-by-field comparison (using `EOPS` and `ANTHRO` as samples)
- Pierce semester volumes
- Customer linkage analysis (per-semester student rows)
- DCC and NonMerch sub-table fill rates
- Companion proc execution stats
- `Acct_Terms_Header` lookup

To re-run for any other template:

```bash
npx tsx scripts/probe-prism-agency-cloning.ts
# Modify the `EOPS` and `ANTHRO` filters in the script to drill into
# any other recurring suffix (USVET, ASO, UMOJA, BUSOFF, DRC, etc.)
```
