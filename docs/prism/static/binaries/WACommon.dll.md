# `WACommon.dll` — static-analysis inventory

- Total extracted strings: **2586**
- Parsed SQL statements: **20**
- Operation breakdown: INSERT=0, UPDATE=1, DELETE=5, SELECT=14, EXEC=0, MERGE=0
- Distinct tables: **15**
- Distinct procs: **0**
- Distinct views: **0**

## Write surface (tables this binary mutates)

| Table | Ops |
|---|---|
| `Acct_Auto_Acct` | DELETE, SELECT |
| `Acct_Auto_Cust` | DELETE, SELECT |
| `Acct_Auto_FinDiv` | DELETE, SELECT |
| `Acct_Auto_Loc` | DELETE, SELECT |
| `Acct_Auto_Vend` | DELETE, SELECT |
| `Acct_PeriodRange` | SELECT, UPDATE |

## Read surface (tables/views referenced via SELECT/JOIN only)

<details><summary>9 tables</summary>

- `Acct_Check_Header`
- `Acct_Financial_Divisions`
- `Acct_Memb_Account`
- `Acct_Pay_Batch_Detail`
- `Acct_Pay_Batch_Header`
- `Acct_Recurring_Expense_Header`
- `Acct_Voucher`
- `Sequence`
- `Sequence_Check_Info`

</details>

## Stored procs called

_None detected._

## Views referenced

_None detected._

## Write statements (verbatim)

### `Acct_Auto_Acct`

```sql
DELETE Acct_Auto_Acct WHERE AutoID = %d AND ModuleID = %d
```

### `Acct_Auto_Cust`

```sql
DELETE Acct_Auto_Cust WHERE AutoID = %d AND ModuleID = %d
```

### `Acct_Auto_FinDiv`

```sql
DELETE Acct_Auto_FinDiv WHERE AutoID = %d AND ModuleID = %d
```

### `Acct_Auto_Loc`

```sql
DELETE Acct_Auto_Loc WHERE AutoID = %d AND ModuleID = %d
```

### `Acct_Auto_Vend`

```sql
DELETE Acct_Auto_Vend WHERE AutoID = %d AND ModuleID = %d
```

### `Acct_PeriodRange`

```sql
Update Acct_PeriodRange Set BeginDate = '%s', EndDate = '%s' where Period = '%s' and AppID = %d
```

## UI message sample (first 50)

These suggest user-facing features the binary implements.

- !This program cannot be run in DOS mode.
- ? ?$?(?,?0?4?8?<?@?D?H?L?P?T?X?\?`?d?h?l?p?t?x?|?
- ? ?$?(?,?0?4?8?<?@?D?H?L?P?T?X?\?`?d?h?x?
- ? ?3?9?E?Q?]?i?u?
- ? ?8?H?X?h?x?
- = =$=(=,=0=4=8=<=L=8?<?@?D?H?L?P?T?X?\?`?d?h?l?p?t?x?|?
- AgencyID = ?
- AutoID = ? AND ModuleID = ?
- Description is required.
- End period cannot be before the begin period.
- ERROR : Unable to initialize critical section in CAtlBaseModule
- GLJournalID = ?
- Include Only Bill to Account Accounts
- Include Only Bill to Customer Accounts
- Invalid Date range specified.
- Nebraska Book Company, Inc.
- No Accounts are selected.
- No Customers are selected.
- SequenceTypeID = %d and SequenceNumber <> 1
- Terms Code is required.
- The Day is Invalid.
- The Month is Invalid.
- This Account already exists.
- This Customer already exists.
- This Financial Division already exists.
- This Vendor already exists.

