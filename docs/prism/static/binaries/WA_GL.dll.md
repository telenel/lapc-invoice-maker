# `WA_GL.dll` — static-analysis inventory

- Total extracted strings: **2826**
- Parsed SQL statements: **45**
- Operation breakdown: INSERT=0, UPDATE=0, DELETE=7, SELECT=38, EXEC=0, MERGE=0
- Distinct tables: **21**
- Distinct procs: **0**
- Distinct views: **5**

## Write surface (tables this binary mutates)

| Table | Ops |
|---|---|
| `Acct_COA_Budget_Detail` | DELETE, SELECT |
| `Acct_COA_Budget_Header` | DELETE, SELECT |
| `Acct_GLJournal_Detail` | DELETE, SELECT |
| `Acct_Journal_REC_Detail` | DELETE, SELECT |
| `current` | DELETE, SELECT |
| `selected` | DELETE, SELECT |

## Read surface (tables/views referenced via SELECT/JOIN only)

<details><summary>15 tables</summary>

- `Acct_Financial_Category_Type`
- `Acct_Financial_Group_Type`
- `Acct_GLBalSheet`
- `Acct_GLBalSheetChange`
- `Acct_GLCashFlow`
- `Acct_GLExport`
- `Acct_GLIncStmt`
- `Acct_GLJournal_Header`
- `Acct_Journal_Rec_Header`
- `Acct_Journal_REC_Header`
- `Acct_PeriodRange`
- `Location`
- `Sequence_Type`
- `SystemParameters`
- `this`

</details>

## Stored procs called

_None detected._

## Views referenced

- `VW_GL_BUDGET_DETAIL`
- `VW_GL_JRNL_DETAIL`
- `VW_GL_JRN_NAV`
- `VW_GL_REC_JRN_DETAIL`
- `VW_GL_REC_JRN_NAV`

## Write statements (verbatim)

### `Acct_COA_Budget_Detail`

```sql
Delete Acct_COA_Budget_Detail where COAHdrBudgetID = %d
```

### `Acct_COA_Budget_Header`

```sql
Delete Acct_COA_Budget_Header where COAHdrBudgetID = %d
```

### `Acct_GLJournal_Detail`

```sql
delete Acct_GLJournal_Detail where GLJournalDtlID = %d
```

### `Acct_Journal_REC_Detail`

```sql
delete Acct_Journal_REC_Detail where RecExpDtlID = %d
```

### `current`

```sql
Delete current entry?
```

### `selected`

```sql
Delete selected detail item(s) from this Entry?
```

```sql
Delete selected detail item(s)?
```

## UI message sample (first 50)

These suggest user-facing features the binary implements.

- ﻿  * Which are System Generated GL Records
-   * Who's GL Period is prior to current GL Period
-  All Open Audit Entries must be Posted Prior to Creating Closing Entries
-  Any changes made to a CLOSED GL Period will REQUIRE Monthly Financials to be REPRINTED.
-  Please ensure Closing Entries have been created for all locations which have Journal entries.
- !This program cannot be run in DOS mode.
- %d recurring entries generated.
- ? ?$?(?,?0?4?8?<?@?D?H?L?P?T?X?\?`?d?h?l?p?t?x?|?
- ? ?$?(?,?0?4?8?<?@?D?H?L?P?T?X?d?h?
- ? ?$?(?,?0?4?8?<?@?D?H?P?T?X?\?`?d?h?l?t?
- ? ?$?(?,?4?8?<?D?\?`?x?
- Are you sure you want to close the current year?
- Are you sure you want to Export the GL data?
- Are you sure you want to generate closing entries?
- Are you sure you want to generate recurring entries?
- Are you sure you want to post Audit Entries?
- Audit Entries DO NOT Exist for the current GL Year
- Cannot run process.  Currently not in the last GL Period of the fiscal year.
- COADtlBudgetID = ?
- COAHdrBudgetID = ? and FiscalYear = ?
- COAID = ? and LocationID = ? and FiscalYear = ?
- Copy complete.
- Create Date...
- Current date is prior to GL month end!  Continue Posting?
- Debit or Credit amount needs to be set.
- Either Debit or Credit not both needs to be set.
- Entry Name has to be unique.
- Entry Name is required.
- ERROR : Unable to initialize critical section in CAtlBaseModule
- Exception thrown in destructor
- GL Code entries do not balance.
- GL data successfully exported.
- GL Period...
- GLJournalDtlID = ?
- If you are using the Date Time Picker UI and Scroll to a new month the date is automatically selected and displayed.  If this date is in a closed period you will get this message
- Information will not be saved
- Journal entries do not balance.
- Nebraska Book Company, Inc.
- Next Date...
- Next Period...
- No detail GL Codes are setup.
- No Recurring Entries need to generated.
- Note! The Next Date and Next Period will automatically be set to the Beginning of the Current GL Period
- NOTE:  Please create Closing and Audit Entries, and run Year End Processing.
- Once You Create Closing Entries you will NOT BE ALLOWED to create Audit Entries
- Please close current GL Period
- Please close Period 12
- Please use the Generate Recurring Entries Module.
- Process completed.
- RecExpDtlID = ?

