# `WPPosCmn.dll` — static-analysis inventory

- Total extracted strings: **7181**
- Parsed SQL statements: **199**
- Operation breakdown: INSERT=15, UPDATE=11, DELETE=52, SELECT=120, EXEC=1, MERGE=0
- Distinct tables: **73**
- Distinct procs: **1**
- Distinct views: **12**

## Write surface (tables this binary mutates)

| Table | Ops |
|---|---|
| `Cash_Cnt_Counts` | DELETE, INSERT, SELECT, UPDATE |
| `Cash_Cnt_Group_Loc` | DELETE, SELECT |
| `Cash_Cnt_Groups` | DELETE, SELECT |
| `Cash_Cnt_Results` | DELETE, SELECT |
| `dbo` | DELETE, INSERT, SELECT |
| `Discount_Codes` | DELETE, SELECT |
| `Discount_Codes_Location` | DELETE, SELECT |
| `FROM` | DELETE, SELECT |
| `Item_Tax_Type` | DELETE, SELECT |
| `Item_Tax_Type_Grouping` | DELETE, INSERT, SELECT |
| `POS_Cash_Count_Shifts` | DELETE, INSERT, SELECT, UPDATE |
| `POS_Fee_Codes` | DELETE, SELECT |
| `POS_Keyboard_Mapping_Groups` | DELETE, SELECT |
| `POS_Keyboard_Mappings` | DELETE, SELECT |
| `POS_MSR_Card_Types` | DELETE, SELECT |
| `POS_MSR_Options` | DELETE, SELECT |
| `POS_Open_History` | DELETE, SELECT |
| `POS_QuickSKU` | DELETE, SELECT |
| `POS_Receipt_Footer` | DELETE, SELECT |
| `POS_Receipt_Header` | DELETE, SELECT |
| `POS_Receipt_Template_Options` | DELETE, SELECT |
| `POS_Receipt_Templates` | DELETE, SELECT |
| `POS_Reg_Groupings` | DELETE, SELECT |
| `POS_Register_Access` | DELETE, SELECT, UPDATE |
| `POS_Register_Access_History` | SELECT, UPDATE |
| `POS_Register_Templates` | DELETE, SELECT |
| `POS_Registers` | DELETE, SELECT |
| `POS_Setup` | DELETE, SELECT |
| `POS_Trans_Types` | DELETE, SELECT |
| `POS_Trans_Types_Location` | DELETE, SELECT |
| `Tax_Code_Group` | DELETE, SELECT |
| `Tax_Code_Grouping` | DELETE, SELECT, UPDATE |
| `Tax_Codes` | DELETE, SELECT |
| `Tax_Codes_Location` | DELETE, INSERT, SELECT |
| `Tax_Jurisdiction` | DELETE, INSERT, SELECT |
| `Tax_Shift_Profiles` | DELETE, SELECT |
| `Tax_Tables` | DELETE, SELECT |
| `Tender_Codes` | DELETE, SELECT |
| `Tender_Codes_BIN_Rng` | DELETE, SELECT |
| `Tender_Codes_Location` | DELETE, SELECT |
| `Tender_Codes_Multi` | DELETE, INSERT, SELECT |

## Read surface (tables/views referenced via SELECT/JOIN only)

<details><summary>32 tables</summary>

- `Acct_COA`
- `Country`
- `Currency_Exchange`
- `Discount_Codes_Method`
- `Discount_Codes_Type`
- `inventory`
- `location`
- `Location`
- `POS_DCC_Methods`
- `POS_Fee_Code_Type`
- `Pos_Group_Types`
- `POS_Groups`
- `POS_Open_history`
- `POS_Receipt_Barcode_Types`
- `POS_Receipt_Fonts`
- `POS_Receipt_Types`
- `POS_Register_Type`
- `pos_setup`
- `Pos_Setup`
- `POS_setup`
- `Pos_Setup_DistType`
- `POS_Sig_Types`
- `POS_Trans_Security_Level`
- `prism`
- `sequence`
- `State_Code`
- `Store_Information_Table`
- `Tax_Type`
- `tender_auth_types`
- `Tender_Auth_Types`
- `Tender_Queues`
- `Transaction_Header`

</details>

## Stored procs called

- `LockSettlementReportStatus`

## Views referenced

- `VW_DCC_LOOKUP`
- `VW_POS_NON_MERCH`
- `VW_POS_OPEN_HIST_MAX_ALL`
- `VW_POS_PAY_IN_OUT`
- `VW_POS_RA_HISTORY`
- `VW_POS_RA_HISTORY_SS`
- `VW_POS_REG_ACCS_SEL_CASHIER`
- `VW_POS_REG_ACTIVITY`
- `VW_POS_REPORT_LOGO`
- `VW_POS_SEQ_SERIES`
- `VW_POS_SETUP`
- `VW_POS_TENDER_QUEUE_SETTLEMENT`

## Write statements (verbatim)

### `Cash_Cnt_Counts`

```sql
DELETE FROM Cash_Cnt_Counts WHERE GroupID = %ld
```

```sql
INSERT INTO Cash_Cnt_Counts (GroupID,  [Date]) VALUES (%ld, getdate())
```

```sql
UPDATE Cash_Cnt_Counts SET [Date] = getdate(), fCompleted = 1 WHERE GroupID = %ld
```

```sql
UPDATE Cash_Cnt_Counts SET fPosted = 1 WHERE GroupID = %ld
```

### `Cash_Cnt_Group_Loc`

```sql
delete from Cash_Cnt_Group_Loc where CashCntGroupID = %ld
```

```sql
delete from Cash_Cnt_Group_Loc where CashCntGroupLocID = %ld
```

### `Cash_Cnt_Groups`

```sql
delete from Cash_Cnt_Groups where CashCntGroupID = %ld
```

### `Cash_Cnt_Results`

```sql
DELETE FROM Cash_Cnt_Results WHERE GroupID = %ld
```

### `Discount_Codes`

```sql
DELETE Discount_Codes WHERE DiscID = %ld
```

### `Discount_Codes_Location`

```sql
DELETE Discount_Codes_Location WHERE DiscID = %ld
```

### `FROM`

```sql
DELETE FROM %s WHERE ReceiptTemplateID = %ld
```

### `Item_Tax_Type`

```sql
DELETE FROM Item_Tax_Type WHERE ItemTaxTypeID = %ld
```

### `Item_Tax_Type_Grouping`

```sql
DELETE FROM Item_Tax_Type_Grouping WHERE ItemTaxTypeGrpID = %ld
```

```sql
DELETE FROM Item_Tax_Type_Grouping WHERE ItemTaxTypeID = %ld
```

```sql
INSERT INTO Item_Tax_Type_Grouping (ItemTaxTypeID, LocationID, POSID, TaxProfileID, TaxGroupID) VALUES (%d, %d, %d, %d, %d)
```

### `POS_Cash_Count_Shifts`

```sql
DELETE FROM POS_Cash_Count_Shifts WHERE CashCntShiftID = %ld
```

```sql
DELETE FROM POS_Cash_Count_Shifts WHERE GroupID = %ld
```

```sql
INSERT INTO POS_Cash_Count_Shifts (GroupID, RegAccessHistID, RegisterID, CashDrawer, UserID, LogOnDate, LogOffDate) VALUES (%ld, %ld, %ld, %d, %ld, %s, %s) 
```

```sql
INSERT INTO POS_Cash_Count_Shifts DEFAULT VALUES
```

```sql
UPDATE POS_Cash_Count_Shifts SET GroupID = CashCntShiftID, RegAccessHistID = %ld, RegisterID = %ld, CashDrawer = %d, UserID = %ld, LogOnDate = %s, LogOffDate = %s WHERE CashCntShiftID = %ld AND GroupID is null
```

### `POS_Fee_Codes`

```sql
delete from POS_Fee_Codes where FeeCodeID = %ld
```

### `POS_Keyboard_Mapping_Groups`

```sql
delete from POS_Keyboard_Mapping_Groups where MappingGroup = %d
```

### `POS_Keyboard_Mappings`

```sql
delete from POS_Keyboard_Mappings where (VK_Code = %d) AND (ScanCode = %d) AND (MappingGroup = %d) 
```

```sql
delete from POS_Keyboard_Mappings where MappingGroup = %d
```

### `POS_MSR_Card_Types`

```sql
delete from POS_MSR_Card_Types where MSRID = %d
```

### `POS_MSR_Options`

```sql
delete from POS_MSR_Options where MSRID = %d
```

```sql
DELETE FROM POS_MSR_Options WHERE MSROID = %ld
```

### `POS_Open_History`

```sql
delete from POS_Open_History where POSID = %d
```

### `POS_QuickSKU`

```sql
delete from POS_QuickSKU where QuickSKU = %ld and POSID = %ld
```

### `POS_Receipt_Footer`

```sql
delete from POS_Receipt_Footer where ReceiptTemplateID = %ld
```

### `POS_Receipt_Header`

```sql
delete from POS_Receipt_Header where ReceiptTemplateID = %ld
```

### `POS_Receipt_Template_Options`

```sql
delete from POS_Receipt_Template_Options where ReceiptTemplateID = %ld
```

### `POS_Receipt_Templates`

```sql
delete from POS_Receipt_Templates where ReceiptTemplateID = %ld
```

### `POS_Reg_Groupings`

```sql
delete from POS_Reg_Groupings where GroupingID = %ld
```

### `POS_Register_Access`

```sql
DELETE FROM POS_Register_Access WHERE POS_Register_Access.UserID = %ld AND POS_Register_Access.RegisterID IN (SELECT RegisterID FROM POS_Registers INNER JOIN Pos_Setup ON POS_Registers.POSID = Pos_Setup.POSID WHERE Pos_Setup.LocationID = %ld)
```

```sql
update POS_Register_Access set fCanOverride = %d where UserID = %d and RegisterID in (select RegisterID from POS_Registers pr inner join POS_Setup ps on ps.POSID = pr.POSID where ps.LocationID = %d)
```

### `POS_Register_Access_History`

```sql
UPDATE POS_Register_Access_History SET fPostPending = 0 WHERE RegAccessHistID = %ld
```

```sql
UPDATE POS_Register_Access_History SET fPostPending = 0%s WHERE RegAccessHistID = %ld
```

```sql
UPDATE POS_Register_Access_History SET fPostPending = 1 WHERE RegAccessHistID = %ld
```

### `POS_Register_Templates`

```sql
DELETE FROM POS_Register_Templates WHERE RegisterID = %ld
```

### `POS_Registers`

```sql
DELETE FROM POS_Registers WHERE POS_Registers.RegisterID = %ld
```

### `POS_Setup`

```sql
delete from POS_Setup where POSID = %d
```

### `POS_Trans_Types`

```sql
delete from POS_Trans_Types where TransTypeID = %ld
```

### `POS_Trans_Types_Location`

```sql
delete from POS_Trans_Types_Location where TransTypeID = %ld
```

```sql
delete from POS_Trans_Types_Location where TransTypeLocID = %ld
```

### `Tax_Code_Group`

```sql
DELETE FROM Tax_Code_Group WHERE TaxGroupID = %ld
```

### `Tax_Code_Grouping`

```sql
DELETE FROM Tax_Code_Grouping WHERE TaxCodeGroupingID = %ld
```

```sql
DELETE FROM Tax_Code_Grouping WHERE TaxGroupID = %ld
```

```sql
UPDATE Tax_Code_Grouping SET StackOnTxCdID = 0 WHERE StackOnTxCdID = %ld
```

### `Tax_Codes`

```sql
delete from Tax_Codes where TaxCodeID = %ld
```

### `Tax_Codes_Location`

```sql
DELETE FROM Tax_Codes_Location WHERE TaxCodeLocID = %ld
```

```sql
DELETE FROM Tax_Codes_Location WHERE TaxGroupID = %ld
```

```sql
INSERT INTO Tax_Codes_Location ([TaxGroupID], [LocationID]) VALUES (%ld, %ld)
```

### `Tax_Jurisdiction`

```sql
DELETE FROM Tax_Jurisdiction WHERE TaxGroupID = %ld
```

```sql
insert into Tax_Jurisdiction (TaxGroupID, PostalCode, City) values(%d, %s, %s)
```

### `Tax_Shift_Profiles`

```sql
delete from Tax_Shift_Profiles where TaxProfileID = %ld
```

### `Tax_Tables`

```sql
DELETE FROM Tax_Tables WHERE TaxTableID = %ld
```

### `Tender_Codes`

```sql
delete from Tender_Codes where TenderCodeID = %ld
```

### `Tender_Codes_BIN_Rng`

```sql
DELETE FROM Tender_Codes_BIN_Rng WHERE TenderCodeID = %ld and TenderCodeBINRngID = %ld
```

### `Tender_Codes_Location`

```sql
delete from Tender_Codes_Location where TenderCodeID = %ld
```

```sql
delete from Tender_Codes_Location where TenderCodeLocID = %ld
```

### `Tender_Codes_Multi`

```sql
delete from Tender_Codes_Multi where TenderCodeID = %ld
```

```sql
DELETE FROM Tender_Codes_Multi WHERE TenderCodeID = %ld and LinkedTenderCodeID = %ld
```

```sql
INSERT INTO Tender_Codes_Multi (TenderCodeID, LinkedTenderCodeID) VALUES (%ld, %ld)
```

### `VW_POS_RA_HISTORY`

```sql
UPDATE VW_POS_RA_HISTORY SET fPostPending = 0 WHERE %s AND POSID = %ld AND dbo.fnIsDatePartEqual(LogOnDate, %s) = 1
```

```sql
UPDATE VW_POS_RA_HISTORY SET fPostPending = 0%s WHERE %s AND POSID = %ld AND dbo.fnIsDatePartEqual(LogOnDate, %s) = 1
```

```sql
UPDATE VW_POS_RA_HISTORY SET fPostPending = 1 WHERE %s AND POSID = %ld AND dbo.fnIsDatePartEqual(LogOnDate, %s) = 1
```

### `dbo`

```sql
delete [dbo].[POS_Register_Access] where UserID = %ld and RegisterID = %ld
```

```sql
DELETE FROM [dbo].[Discount_Codes_Location] WHERE DiscLocID = %ld
```

```sql
delete from [dbo].[POS_Groups] where GroupID = %ld
```

```sql
INSERT INTO [dbo].[Cash_Cnt_Group_Loc] ([CashCntGroupID], [POSID]) VALUES (%ld, %ld)
```

```sql
INSERT INTO [dbo].[Discount_Codes_Location] ([DiscID], [POSID]) VALUES (%ld, %ld)
```

```sql
INSERT INTO [dbo].[POS_MSR_Options] ([MSRID], [MSROTYPEID]) VALUES (%d, %d)
```

```sql
INSERT INTO [dbo].[POS_Register_Access] ([UserID], [RegisterID]) VALUES (%ld, %ld)
```

```sql
INSERT INTO [dbo].[POS_Trans_Types_Location] ([TransTypeID], [POSID]) VALUES (%ld, %ld)
```

```sql
INSERT INTO [dbo].[Tax_Code_Grouping] ([TaxGroupID], [TaxCodeID]) VALUES (%ld, %ld)
```

```sql
INSERT INTO [dbo].[Tender_Codes_Location] ([TenderCodeID], [POSID]) VALUES (%ld, %ld)
```

## UI message sample (first 50)

These suggest user-facing features the binary implements.

-  and fDistributed not in (3, 4) AND 
-  Description like '%s%%'
-  LocDesc like '%s%%'
-  MasterDesc like '%s%%'
-  PosDesc like '%s%%'
-  TaxTableDesc like '%s%%'
-  TemplateName like '%s%%'
-  VW_POS_MSR_HDR.CardTypeDesc like '%s%%'
-  VW_POS_REG_ACCS_CASHIER.Name like '%s%%'
-  VW_POS_REG_ACCS_CASHIER.UserName like '%s%%'
- !This program cannot be run in DOS mode.
- ? ?$?(?,?0?<?@?l?
- ? ?$?(?,?0?4?8?<?@?D?H?L?P?T?X?\?`?d?h?l?
- ? ?$?(?,?0?4?8?<?@?D?H?L?P?T?X?\?`?d?h?l?p?t?x?|?
- ? ?$?(?,?0?4?8?<?@?D?H?L?P?X?p?
- ? ?$?(?,?0?4?8?<?@?D?H?P?h?l?
- ? ?$?(?,?0?4?8?<?@?h?l?p?t?x?|?
- ? ?$?(?,?0?4?8?<?@?T?X?\?`?d?h?l?p?t?
- ? ?$?(?4?8?\?t?
- ? ?&?,?2?8?>?D?J?P?V?\?b?h?n?t?z?
- ? ?(?4?T?`?h?
- ? ?,?0?4?8?<?@?D?H?L?P?T?X?\?`?d?h?l?p?t?x?|?
- ? ?0?@?D?H?L?P?T?X?\?`?d?h?l?p?t?x?|?
- ? ?0?4?8?<?@?D?H?L?P?T?X?\?`?d?h?l?p?t?|?
- ? ?0?4?8?<?@?D?H?L?P?X?p?
- [RegAccessID] = ?
- > ?5?<?L?e?v?
- A POS System is needed.
- A sequence series already exists.
- Are you sure you want to clear all pending cash counts?
- CloseDate is not null
- CurrencyExID = ?
- Description already exists in table.  Choose another.
- Description is Required.
- Description like '%s%%'
- Do you want to edit that record?
- ERROR : Unable to initialize critical section in CAtlBaseModule
- Exception thrown in destructor
- fDistributed in (1, 2, 5) and POSID < 0x71000000
- Force Log off?
- GroupID > 0 and GroupTypeID = ?
- GroupTypeID = %ld and GroupID > 0
- Invalid item.
- Inventory does not exist for that SKU.
- ItemTaxTypeID = ?
- LocationId in (%s)
- MappingGroup = ?
- Nebraska Book Company, Inc.
- No register access records selected
- No rows are selected

