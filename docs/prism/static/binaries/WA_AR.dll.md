# `WA_AR.dll` — static-analysis inventory

- Total extracted strings: **6496**
- Parsed SQL statements: **160**
- Operation breakdown: INSERT=3, UPDATE=9, DELETE=36, SELECT=112, EXEC=0, MERGE=0
- Distinct tables: **82**
- Distinct procs: **1**
- Distinct views: **7**

## Write surface (tables this binary mutates)

| Table | Ops |
|---|---|
| `Acct_Adjust_Detail` | DELETE, SELECT, UPDATE |
| `Acct_Adjust_Header` | DELETE, SELECT, UPDATE |
| `Acct_Agency_NonMerch` | DELETE, INSERT, SELECT |
| `Acct_ARInvoice_Detail` | DELETE, SELECT |
| `Acct_ARInvoice_Header` | DELETE, SELECT, UPDATE |
| `acct_ARInvoice_Pymt` | DELETE, SELECT |
| `Acct_ARInvoice_Pymt` | DELETE, SELECT |
| `Acct_Auto_Loc` | DELETE, SELECT |
| `Acct_Memb_Account` | SELECT, UPDATE |
| `Acct_Memb_Acct_Cust` | INSERT, SELECT |
| `Acct_Memb_Detail` | DELETE, SELECT |
| `Acct_Memb_Header` | DELETE, SELECT, UPDATE |
| `Acct_Memb_Setup_Card` | DELETE, SELECT |
| `Acct_Memb_Tier` | SELECT, UPDATE |
| `acct_Memb_Tier_detail` | DELETE, SELECT |
| `Acct_Memb_Tier_Detail` | SELECT, UPDATE |
| `Calculate` | DELETE, SELECT |
| `current` | DELETE, SELECT |
| `Customer_Table` | SELECT, UPDATE |
| `Dunning` | DELETE, SELECT |
| `Entire` | DELETE, SELECT |
| `Export` | DELETE, SELECT |
| `Letter` | DELETE, SELECT |
| `Mailing` | DELETE, SELECT |
| `Purge` | DELETE, SELECT |
| `selected` | DELETE, SELECT |
| `Statement` | DELETE, SELECT |
| `these` | DELETE, SELECT |
| `this` | DELETE, SELECT |

## Read surface (tables/views referenced via SELECT/JOIN only)

<details><summary>53 tables</summary>

- `acct_agency`
- `Acct_Agency`
- `acct_agency_customer`
- `Acct_Agency_Customer`
- `acct_agency_group`
- `Acct_Agency_Group`
- `Acct_Agency_Non_Merch_Opt`
- `acct_agency_type`
- `Acct_Agency_Type`
- `acct_apply`
- `Acct_ARAuto_Pymt`
- `Acct_ARAutogen_Inv`
- `Acct_ARCalcFinChg`
- `Acct_ARDunning`
- `Acct_ARExport`
- `acct_arinvoice_giftcert`
- `acct_arinvoice_header`
- `Acct_ARMail_Labels`
- `Acct_ARPurgeFinAid`
- `Acct_ARPurgePymt`
- `Acct_ARRptAging`
- `Acct_ARStmt`
- `Acct_Auto_Acct`
- `acct_balance_type`
- `acct_memb_account`
- `acct_memb_acct_cust`
- `Acct_Memb_Mail_Labels`
- `Acct_Memb_Setup`
- `Acct_Memb_Stmt`
- `Acct_PeriodRange`
- `acct_statement_codes`
- `Acct_Statement_Codes`
- `customer_table`
- `Discount_Codes`
- `Discount_Codes_Type`
- `Location`
- `POS_MSR_Card_Types`
- `POS_Registers`
- `pos_setup`
- `Pos_Setup`
- `POS_Setup`
- `prism_security`
- `sequence`
- `Sequence_Type`
- `Status_Codes`
- `systemparameters`
- `SystemParameters`
- `Tender_codes`
- `tender_codes_location`
- `Transaction_Header`
- `Transaction_Signature`
- `transaction_tender`
- `Transaction_Tender`

</details>

## Stored procs called

- `CatalogID`

## Views referenced

- `VW_AR_BADCHK_HEADER`
- `VW_AR_TRANS_DETAIL_SUM`
- `VW_ITM_MASTER`
- `VW_POS_NON_MERCH`
- `VW_POS_OPEN_HIST_MAX_ALL`
- `Vw_Tender_Code_Loc`
- `vw_ar_giftcert_detail`

## Write statements (verbatim)

### `Acct_ARInvoice_Detail`

```sql
DELETE Acct_ARInvoice_Detail WHERE ARInvoiceID = %d
```

```sql
DELETE FROM Acct_ARInvoice_Detail WHERE ARInvoiceID = %ld AND SKU = %ld
```

### `Acct_ARInvoice_Header`

```sql
DELETE Acct_ARInvoice_Header WHERE ARInvoiceID = %d
```

```sql
update Acct_ARInvoice_Header set fDoGL = 0 where ARInvoiceID = %ld
```

```sql
update Acct_ARInvoice_Header set fDoGL = 1 where ARInvoiceID = %ld
```

### `Acct_ARInvoice_Pymt`

```sql
delete Acct_ARInvoice_Pymt where ARInvoiceID = %d and CustomerID = %d and AgencyID = %d
```

### `Acct_Adjust_Detail`

```sql
DELETE Acct_Adjust_Detail WHERE TransferID = %d
```

```sql
delete Acct_Adjust_Detail where TransferID = %d and Amount < 0
```

```sql
delete Acct_Adjust_Detail where TransferID = %d and Amount > 0
```

```sql
DELETE FROM Acct_Adjust_Detail WHERE TransferDtlID = %ld
```

```sql
Update Acct_Adjust_Detail set AcctApplyID = 0 where TransferID = %d
```

### `Acct_Adjust_Header`

```sql
DELETE Acct_Adjust_Header WHERE TransferID = %d
```

```sql
UPDATE Acct_Adjust_Header SET Balance = %s WHERE TransferID = %d
```

### `Acct_Agency_NonMerch`

```sql
DELETE FROM Acct_Agency_NonMerch WHERE AcctAgncyNMrchID = %ld
```

```sql
DELETE FROM Acct_Agency_NonMerch where AgencyID = %ld and fG3 = 0
```

```sql
DELETE FROM Acct_Agency_NonMerch where AgencyID = %ld and fG3 = 1
```

```sql
INSERT INTO Acct_Agency_NonMerch (AgencyID, fG3, FeeCodeDescr) VALUES (%ld, 0, '%3d')
```

```sql
INSERT INTO Acct_Agency_NonMerch (AgencyID, fG3, FeeCodeDescr) VALUES (%ld, 1, '%s')
```

### `Acct_Auto_Loc`

```sql
delete from Acct_Auto_Loc where ModuleID = %ld and AutoID = %ld
```

### `Acct_Memb_Account`

```sql
update Acct_Memb_Account set Priority = %d where MemAcctID = %d
```

### `Acct_Memb_Acct_Cust`

```sql
Insert into Acct_Memb_Acct_Cust (MemAcctID, CustomerID, fStatus, fAccountLimit, AccountLImit, StartDate, ExpDate) select Acct_Memb_Tier_Detail.MemAcctID, %d, 1, Acct_Memb_Account.fAccountLimit, Acct_Memb_Account.AccountLimit, StartDate, EndDate from Acct_Memb_Tier_Detail inner join Acct_Memb_Account on Acct_Memb_Tier_Detail.MemAcctID = Acct_Memb_Account.MemAcctID where Acct_Memb_Tier_Detail.MemTierID = %d
```

### `Acct_Memb_Detail`

```sql
DELETE Acct_Memb_Detail WHERE MemTranID = %d
```

```sql
DELETE FROM Acct_Memb_Detail WHERE MemTranDtlID = %ld
```

### `Acct_Memb_Header`

```sql
DELETE Acct_Memb_Header WHERE MemTranID = %d
```

```sql
UPDATE Acct_Memb_Header SET TranTotal = %.2f WHERE MemTranID = %ld
```

### `Acct_Memb_Setup_Card`

```sql
delete Acct_Memb_Setup_Card where MemSetupID = %d
```

### `Acct_Memb_Tier`

```sql
update Acct_Memb_Tier set TierPriority = %d where MemTierID = %d
```

### `Acct_Memb_Tier_Detail`

```sql
update Acct_Memb_Tier_Detail set Priority = %d where MemTierDtlID = %d
```

### `Calculate`

```sql
Delete Calculate Finance Charges Record?
```

### `Customer_Table`

```sql
UPDATE Customer_Table Set BadCheckNumber = '%s' WHERE CustomerID = %d
```

### `Dunning`

```sql
Delete Dunning Letter record?
```

### `Entire`

```sql
Delete Entire Gift Certificate Invoice?
```

### `Export`

```sql
Delete Export Record?
```

### `Letter`

```sql
Delete Letter Record?
```

### `Mailing`

```sql
Delete Mailing Label Record?
```

### `Purge`

```sql
Delete Purge Payment Record?
```

### `Statement`

```sql
Delete Statement Record?
```

### `acct_ARInvoice_Pymt`

```sql
delete acct_ARInvoice_Pymt where ARInvDtlPymtID = %d
```

### `acct_Memb_Tier_detail`

```sql
delete acct_Memb_Tier_detail where MemTierDtlID = %d
```

### `current`

```sql
Delete current payment?
```

```sql
Delete current purge record?
```

```sql
Delete current setup?
```

```sql
Delete current tier?
```

### `selected`

```sql
Delete selected account(s)?
```

```sql
Delete selected item(s) from this Adjustment
```

```sql
Delete selected item(s) from this Payment
```

### `these`

```sql
Delete these terms?
```

### `this`

```sql
Delete this account?
```

## UI message sample (first 50)

These suggest user-facing features the binary implements.

-  Description like '%s%%'
-  Payment date tried: %s
-  Unknown error 
- !This program cannot be run in DOS mode.
- %d Customer/Account record was not removed
- %d Customer/Account records were not removed
- %d invoices were created.
- %d payment(s) were allocated.
- (ProcessDate between '%s 00:00:00' and '%s 23:59:59' or (ProcessDate is null and CreateDate between '%s 00:00:00' and '%s 23:59:59'))
- ? ?$?(?,?0?4?8?<?@?D?H?L?P?T?X?\?`?d?h?l?p?t?x?|?
- ? ?$?(?,?0?4?8?<?@?D?H?L?P?T?X?\?`?d?h?t?x?
- ? ?$?(?,?8?<?H?L?P?T?X?\?`?d?h?l?p?t?x?|?
- ? ?$?(?0?H?X?h?l?p?t?x?|?
- ? ?&?,?2?8?>?D?J?P?V?\?b?h?n?t?z?
- ? ?(?4?T?\?d?l?
- ? ?)?.?4?8?=?V?d?
- ? ?/?>?M?\?v?
- ? ?@?\?d?l?x?
- ? ?0?4?D?H?L?P?T?X?\?`?d?h?l?t?
- ? ?3?9?L?R?e?k?~?
- A payment for this customer/account already exists.
- A valid date is needed.
- A valid GL Account is needed.
- A/R current month successfully closed.
- A/R data successfully exported.
- Account already defined for this customer.
- Account Code is not unique.
- Account Code is required.
- Account has been marked to be resent.
- Account information has been marked to be resent.
- Account is in use. Cannot be deleted.
- Account is required.
- Account Name is required.
- Account Statements have not been printed.
- Account Statements have not been printed. Continue?
- Accounts need to be selected via some method.
- AcctTermID = ?
- Activate completed successfully
- Adjustment amount cannot be 0.0.
- Adjustment Number already exists in system. 
- Adjustment Number is required.
- Adjustments which have their AR Period in a Closed Period cannot be Reversed
- AgencyCustID = ?
- AgencyID = ?
- Allocate to Invoice
- Allocated amount exceeds unallocated.
- Allocated cannot be negative.
- An beginning customer must be selected.
- An ending customer must be selected.
- An existing inactive tier must be selected.

