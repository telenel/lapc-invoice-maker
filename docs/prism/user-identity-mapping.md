# User identity in WinPRISM — Pierce staff and the WPAdmin shared account

Reference doc for laportal's plan to attribute Prism writes to the **actual user** instead of the connection's SQL service login. Built to answer the question "when laportal creates a row in `Acct_ARInvoice_Header` (or any of the 30+ audit-bearing tables), what value should `UserID` be?"

Authored 2026-04-25. Plan-cache + read-only `prism_security.dbo.PrismUser` lookups; no Prism writes by the analysis itself.

## Why this matters

Many Prism tables carry a `UserID` (or `ProcessUser`, `ModifiedBy`, `CreatedBy`) column whose value should be the **app-level user's identifier**, not the SQL service-account login. WPAdmin authenticates each user against `prism_security.dbo.PrismUser` and stamps the user's `SUID` onto every write. WPAdmin/PrismCore reports then look up `SUID` against `PrismUser.Name` to render a human label like "Marcos Montalvo."

laportal currently connects to WinPRISM as the `pdt` service account. If laportal does nothing extra, the `UserID` columns on rows it creates would either be unset or stamped with `pdt`-equivalent values. Neither is correct. The fix is small: laportal stores each Pierce staff member's `SUID` and passes it as `@UserID` (or fills the column) on every write.

This doc captures the lookup shape and the two reference accounts we have profiled — Marcos's personal account, and the legacy `WPAdmin` shared account — so the laportal mapping can be set up confidently.

## Schema: `prism_security.dbo.PrismUser`

20 columns. The relevant ones for laportal:

| Column | Type | Role |
|---|---|---|
| `SUID` | `smallint IDENTITY` | The integer key that goes into `UserID` columns and `@UserID` proc params. |
| `UserName` | `char(40)` | What the user types at WPAdmin / register login. Padded with spaces; trim before comparison. |
| `Name` | `varchar(255)` | Display name (e.g., "Marcos Montalvo"). Shown in WPAdmin / PrismCore reports. |
| `Password` | `varchar(512)` | Hashed (base64-encoded, salted). Not relevant to laportal — we don't authenticate against this; laportal authenticates via NextAuth and uses the SUID as a **mapping key**. |
| `Email`, `Phone`, `Address`, `City`, … | varchar | Profile fields. Frequently NULL for active accounts. |
| `EmployeeID` | `varchar(50)` | Optional employee identifier. NULL for both reference accounts. |
| `fDisabled` | `tinyint` | `0` = active, `1` = disabled. Filter on this when looking up a user. |
| `fBuyer` | `tinyint` | Flags users authorized for purchase-order workflows. Both reference accounts have it set. |
| `SuperUser` | `varchar(32)` | Encrypted blob — likely flags elevated permissions. Don't try to decode. |
| `RequestsEmailReadReceipts` | `tinyint` | Per-user mail preference. |
| `fMustChange` | `tinyint` | Force password change on next login. |

`SUID` is `smallint` (max 32,767). Pierce's max so far is in the 800s; plenty of headroom.

## Reference profile: Marcos Montalvo (SUID 865)

The personal account a Pierce admin uses day-to-day.

| Field | Value |
|---|---|
| **`SUID`** | **`865`** |
| `UserName` | `2020` (also the register login PIN) |
| `Name` | `Marcos Montalvo` |
| `fDisabled` | `0` (active) |
| `fBuyer` | `1` |
| `fMustChange` | `0` |
| Address / Email / Phone / EmployeeID | NULL |
| First write activity | 2022-02-16 |
| Most recent write activity | 2025-02-26 |

### Module access (`UserAccount` rows for SUID 865)

Six dataset memberships — the same surface every Pierce admin needs:

| `DatasetID` | `AccountDesc` (Marcos) | What it gates |
|---:|---|---|
| 1 | Textbook Buyers | Purchasing / textbook buyer role |
| 2 | AR | Accounts Receivable module |
| 3 | Reg | Register / POS module |
| 7 | ICS WPAdmin | Inventory Control System admin |
| 14 | IAS WPAdmin | Inventory Adjustment System admin |
| 16 | POS Admin | POS administration |

### Activity attributed to SUID 865

| Table | Rows authored |
|---|---:|
| `PO_Receive` | 164 |
| `Acct_ARInvoice_Header` | 83 (~$144,040 total `InvoiceAmt`) |
| `PriceChange` | 47 |
| `PO_Header` | 7 |
| `Invoice_Header` | 1 |

All AR-invoice activity at `LocationID = 2` (Pierce). Workflow profile is **receiving + AR-invoicing + price changes** — the standard Pierce admin set.

## Reference profile: WPAdmin shared account (SUID 69)

The legacy district-wide shared account that's been in use since at least 2011. Still active. Used historically by multiple LACCD bookstores when a personal account isn't available.

| Field | Value |
|---|---|
| **`SUID`** | **`69`** |
| `UserName` | `wpadmin` |
| `Name` | `WPAdmin Logon` |
| `fDisabled` | `0` (active) |
| `fBuyer` | `1` |
| `fMustChange` | `0` |
| First write activity | 2011-06-16 |
| Most recent write activity | 2023-08-31 |

### Module access (`UserAccount` rows for SUID 69)

Identical pattern of 6 datasets to Marcos — same `DatasetID`s, slightly different `AccountDesc` labels:

| `DatasetID` | `AccountDesc` (wpadmin) | Same as Marcos? |
|---:|---|---|
| 1 | `WP ICS` | ✅ same DatasetID (Textbook Buyers role) |
| 2 | `WP Acctg` | ✅ same DatasetID (AR) |
| 3 | `Cashier` | ✅ same DatasetID (Reg) |
| 7 | `ics` | ✅ same DatasetID (ICS WPAdmin) |
| 14 | `ias` | ✅ same DatasetID (IAS WPAdmin) |
| 16 | `pos` | ✅ same DatasetID (POS Admin) |

So the **permission scope is functionally identical**. Only the AccountDesc label varies (cosmetic).

### Activity attributed to SUID 69

| Table | Rows authored |
|---|---:|
| **`PriceChange`** | **3,771** |
| **`PO_Receive`** | **943** |
| **`Invoice_Header`** | **302** (vendor invoices — AP) |
| `PO_Header` | 124 |
| `Acct_ARInvoice_Header` | 89 (~$101,453 total `InvoiceAmt`) |
| `CRT_Header` | 14 |
| `MR_Header` | 6 |
| `Catalog_Sales_Header` | 5 |
| `PackageHeader` | 3 |

AR-invoice activity at multiple LACCD locations — `LocationID = 1` (LA City), `LocationID = 6` (LA Mission), `LocationID = 7` (LA Southwest), among others. **District-wide, not Pierce-specific.**

The high `PriceChange` count (3,771) and the multi-campus distribution tell the story: `wpadmin` has been a generic **fallback / shared identity** for over a decade. When no personal account was logged in, WinPRISM stamped the action with SUID 69.

## Side-by-side

| Aspect | Marcos (SUID 865) | wpadmin (SUID 69) |
|---|---|---|
| `UserName` | `2020` | `wpadmin` |
| `Name` | Marcos Montalvo | WPAdmin Logon |
| Personal vs shared | Personal | Shared (district-wide) |
| `fDisabled` | 0 | 0 |
| `fBuyer` | 1 | 1 |
| Module access | All 6 standard datasets | All 6 standard datasets |
| First activity | 2022-02-16 | 2011-06-16 |
| Most recent activity | 2025-02-26 | 2023-08-31 |
| `Acct_ARInvoice_Header` rows | 83 ($144,040) | 89 ($101,453) |
| `PriceChange` rows | 47 | **3,771** |
| `PO_Receive` rows | 164 | 943 |
| Invoice locations | Pierce only (LocationID=2) | Multi-campus |
| Why we'd use it for laportal | The correct identity for Pierce admin actions | A historical fallback; **avoid** for normal writes |

The two accounts have **identical permissions** but very different intended audiences. SUID 865 is your personal accountable identity at Pierce. SUID 69 is a generic catch-all from before per-user accounts were standard practice — historically convenient, currently an audit anti-pattern.

## Implications for laportal

### Recommended pattern

1. **Add a `prism_user_suid SMALLINT` column** to the laportal `users` table.
2. **One-time admin-controlled mapping**: when a Pierce staff member is onboarded into laportal, an admin (Marcos initially) enters their WPAdmin `UserName` and laportal resolves it to a SUID via a single read-only lookup:

   ```sql
   SELECT TOP 1 SUID
   FROM prism_security.dbo.PrismUser
   WHERE LTRIM(RTRIM(UserName)) = @username AND fDisabled = 0;
   ```

3. **At write time**, every Prism-write code path takes the current laportal user's `prism_user_suid` from the session and:
   - For procs that accept it: passes `@UserID = currentUserSuid`.
   - For direct INSERTs: includes `UserID` in the column list with the SUID value.

4. **Fallback policy** (important): if the active laportal user has **no** mapped `prism_user_suid` (for example, a not-yet-onboarded staff member, or an automated job), the write should either:
   - Refuse to fire (preferred for user-initiated actions — surface "your account isn't mapped to a Prism user yet, ask admin"), or
   - Use a dedicated **laportal service SUID** (NOT `wpadmin`'s SUID 69) for genuinely automated writes.

   **Do not default to SUID 69.** The wpadmin account exists and works, but stamping new writes with it perpetuates the audit anti-pattern this whole effort is trying to fix.

### Per-user fields laportal should manage

- `prism_user_suid` — the integer SUID (set once after admin verification).
- `prism_user_name_cached` — display name from `PrismUser.Name`, refreshed on a timer or stale-after-N-days. Useful for UI without round-tripping to Prism.

### What this fixes

- Every laportal-issued `INSERT INTO Acct_ARInvoice_Header` (and the other ~30 audit-bearing tables) will carry the correct human's SUID.
- WPAdmin and PrismCore reports — including `SP_RPT_AR_INVOICE_ADDTIONAL_INFOMATION`, which joins to `prism_security.dbo.PrismUser` for `UserName` — will display "Marcos Montalvo" (or whoever is the actual actor).
- Prism's existing audit infrastructure remains the canonical record. laportal doesn't need its own audit log for actions that mirror Prism writes.

### What this does NOT fix

- Tables with no `UserID`-equivalent column (notably `Item` from `P_Item_Add_GM`'s INSERT — confirmed in PR #293's plan-cache recovery). Those rows are unauditable at the Prism layer regardless of who creates them. laportal can keep its own audit log for these if needed.
- Triggers that hardcode `SUSER_NAME()` server-side. Those record the SQL login (`pdt`), not the SUID, regardless of what laportal does. We have not yet enumerated which triggers do this; flag for a future small probe pass.

## Looking up a SUID for a new Pierce staff member

When onboarding a new laportal user with a Prism account:

```sql
-- Find their PrismUser row
SELECT
    SUID,
    LTRIM(RTRIM(UserName)) AS UserName,
    Name,
    fDisabled,
    fBuyer
FROM prism_security.dbo.PrismUser
WHERE LTRIM(RTRIM(UserName)) = @input_username
   OR Name LIKE '%' + @input_name + '%';

-- Verify their module access
SELECT UserAcctID, DatasetID, AccountDesc, fDisableAcct
FROM prism_security.dbo.UserAccount
WHERE SUID = @suid
  AND fDisableAcct = 0;
```

If the user has rows for DatasetIDs 1, 2, 3, 7, 14, 16 (the standard Pierce admin set), they have the same permissions Marcos and wpadmin have. Map them in laportal.

## Probes used to gather this data

Both read-only, both saved in this PR:

- [`scripts/probe-prism-user-account.ts`](../../scripts/probe-prism-user-account.ts) — main lookup (column schema, user row, related tables, FK map, AR activity, write-activity inventory).
- [`scripts/probe-prism-user-account-extras.ts`](../../scripts/probe-prism-user-account-extras.ts) — follow-up for `UserAccount` / `UserAcctLocation` / `UserGroup` / `UserMap` data.

To re-run for any other PrismUser:

```bash
npx tsx scripts/probe-prism-user-account.ts <UserName>
npx tsx scripts/probe-prism-user-account-extras.ts <UserName>
```

Both default to `2020` (Marcos's username); pass `wpadmin` for the legacy account, or any other PrismUser.UserName.
