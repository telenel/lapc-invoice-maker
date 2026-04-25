# `WA_AP.dll` — static-analysis inventory

- Total extracted strings: **4019**
- Parsed SQL statements: **84**
- Operation breakdown: INSERT=0, UPDATE=4, DELETE=10, SELECT=70, EXEC=0, MERGE=0
- Distinct tables: **32**
- Distinct procs: **0**
- Distinct views: **10**

## Write surface (tables this binary mutates)

| Table | Ops |
|---|---|
| `Acct_API_Detail` | DELETE, SELECT |
| `Acct_API_Header` | SELECT, UPDATE |
| `Acct_Auto_Acct` | DELETE, SELECT |
| `Acct_Auto_Loc` | DELETE, SELECT |
| `Acct_Credit_Resolved_Detail` | DELETE, SELECT |
| `Acct_Credit_Resolved_Header` | SELECT, UPDATE |
| `Acct_Pay_Batch_Detail` | DELETE, SELECT |
| `current` | DELETE, SELECT |
| `sequence_check_info` | DELETE, SELECT |

## Read surface (tables/views referenced via SELECT/JOIN only)

<details><summary>23 tables</summary>

- `Acct_APCheckType`
- `Acct_APExport`
- `acct_check_header`
- `Acct_Check_Header`
- `Acct_COA`
- `acct_Pay_Batch_Header`
- `Acct_Pay_Batch_header`
- `Acct_Pay_Batch_Header`
- `Acct_Reconciliation_Types`
- `Acct_Recurring_Expense_Header`
- `Acct_Voucher`
- `CD_Header`
- `Freight_Invoice_Header`
- `Invoice_Header`
- `Location`
- `sequence`
- `Sequence`
- `Sequence_Check_Info`
- `Sequence_Type`
- `Status_Codes`
- `SystemParameters`
- `VendorMaster`
- `VendorParameters`

</details>

## Stored procs called

_None detected._

## Views referenced

- `VW_ACCT_RECON_DTL`
- `VW_AP_CHECKMNT_NAV`
- `VW_AP_CHECKSEQ_INFO`
- `VW_AP_CRDMNT_NAVIGATOR`
- `VW_AP_CRMMNT_NAVIGATOR`
- `VW_AP_GENCHKS_NAV`
- `VW_AP_INVMNT_HEADER`
- `VW_AP_INVMNT_NAVIGATOR`
- `VW_AP_INVPYMT_NAV`
- `VW_AP_REC_EXP_NAV`

## Write statements (verbatim)

### `Acct_API_Detail`

```sql
DELETE FROM Acct_API_Detail WHERE APIDetailID = %ld
```

### `Acct_API_Header`

```sql
UPDATE dbo.Acct_API_Header SET fStatus = %ld WHERE APIHeaderID = %ld
```

```sql
UPDATE dbo.Acct_API_Header SET GLPeriod = '%s' WHERE APIHeaderID = %ld
```

### `Acct_Auto_Acct`

```sql
DELETE Acct_Auto_Acct WHERE AutoID = %d AND ModuleID = %d
```

### `Acct_Auto_Loc`

```sql
DELETE Acct_Auto_Loc WHERE AutoID = %d AND ModuleID = %d
```

### `Acct_Credit_Resolved_Detail`

```sql
DELETE FROM Acct_Credit_Resolved_Detail WHERE APCredRslvDtlID = %ld
```

### `Acct_Credit_Resolved_Header`

```sql
UPDATE dbo.Acct_Credit_Resolved_Header SET fStatus = %d WHERE APCredRslvHdrID = %ld
```

### `Acct_Pay_Batch_Detail`

```sql
delete Acct_Pay_Batch_Detail where BatchDtlID = %d
```

```sql
delete Acct_Pay_Batch_Detail where BatchID = %d
```

```sql
delete Acct_Pay_Batch_Detail where VendorID = %d and BatchID = %d
```

### `current`

```sql
Delete current batch?
```

```sql
Delete current reconciliation header?
```

### `sequence_check_info`

```sql
delete sequence_check_info where sequenceID = %d
```

## UI message sample (first 50)

These suggest user-facing features the binary implements.

- !This program cannot be run in DOS mode.
- %d invoices generated.
- ? ?$?(?,?0?4?8?<?@?D?H?L?P?T?X?\?`?d?h?l?p?t?x?|?
- ? ?&?,?2?8?>?D?J?P?V?\?b?h?n?t?z?
- ? ?=?I?N?\?b?r?w?
- ? ?2?J?\?e?q?{?
- ? ?J?P?j?r?x?
- A check sequence must be selected.
- A/P current month successfully closed.
- All Batch Detail records must match the Check Sequence Currency Exchange.
- AP data successfully exported.
- APCredRslvDtlID = ?
- APCredRslvHdrID = ?
- APIDetailID = ?
- APIHeaderID = ?
- APRetHdrID = ?
- Are you sure this is what you want?
- Are you sure you want to close the current month?
- Are you sure you want to create a new invoice?
- Are you sure you want to create a new memo?
- Are you sure you want to Export the AP data?
- Are you sure you want to generate checks?
- Are you sure you want to generate recurring expenses?
- Autogen Process completed.
- Available discount is $ %.2f
- Batch %d has been posted
- Batch name is already in use.
- BatchDtlID = ?
- Both Expense and Inventory
- cannot toggle to a hold status.
- Change Invoice Status for Period
- Change to Hold Period
- Change to POST Period
- Check amount is required.
- Check Date...
- Check generation successfully completed.
- Click OK to accept  Or  Click Cancel
- Combination of discount and payment cannot be greater than outstanding.
- Create Date...
- Credit amount cannot be greater than unused amount
- Credit amount is required.
- Credit cannot exceed unused.
- Credit Memo is assigned to a prior period.
- Credit Memo is required.
- Credit Memo must be set to either the Current Period or a Future Period
- Credit Memo was posted in ICS in a previous period and cannot be reversed.
- Date is Required.
- Discount cannot exceed available.
- Edit Credit to Use
- Edit Invoice for Payment

