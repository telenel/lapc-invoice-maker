# `WPComm.dll` — static-analysis inventory

- Total extracted strings: **8446**
- Parsed SQL statements: **138**
- Operation breakdown: INSERT=2, UPDATE=9, DELETE=6, SELECT=120, EXEC=1, MERGE=0
- Distinct tables: **51**
- Distinct procs: **2**
- Distinct views: **4**

## Write surface (tables this binary mutates)

| Table | Ops |
|---|---|
| `Catalog_Sales_Header` | SELECT, UPDATE |
| `ModuleLocking` | DELETE, INSERT, SELECT |
| `OposLog` | INSERT, SELECT |
| `prism_security` | DELETE, SELECT, UPDATE |
| `Rental_MO_Xref` | DELETE, SELECT |
| `SortHeader` | DELETE, SELECT |
| `SystemParameters` | SELECT, UPDATE |
| `Transaction_Detail` | SELECT, UPDATE |
| `Transaction_Header` | SELECT, UPDATE |
| `Transaction_Tax` | DELETE, SELECT |
| `Transaction_Tax_Detail` | DELETE, SELECT |

## Read surface (tables/views referenced via SELECT/JOIN only)

<details><summary>40 tables</summary>

- `BundleTrans_Header`
- `Buyback_Header`
- `Catalog_Sales_detail`
- `Catalog_Sales_Detail`
- `Customer_Address`
- `Customer_Table`
- `Item_Components_Detail`
- `Item_Components_Header`
- `MO_Shipping_Codes`
- `MORefundRentalTranDtl_vw`
- `NMRPTransactionDetail`
- `POS_Device`
- `POS_MSR_Options`
- `POS_Receipt_Types`
- `POS_Register_Templates`
- `POS_Registers`
- `Pos_Setup`
- `POS_Setup`
- `Rental_Adoption_Header`
- `Rental_Header_Item`
- `Rental_History`
- `Rental_Setup_Pos`
- `ReportCustom`
- `ReportMaster`
- `SalesTypes`
- `State_Code`
- `systemparameters`
- `Tender_Auth_Types`
- `Tender_Codes`
- `Tender_Codes_Location`
- `Tender_Queues`
- `Textbook`
- `Transaction_Address`
- `Transaction_AVSText`
- `transaction_detail`
- `Transaction_Detail_Tender`
- `transaction_header`
- `Transaction_Signature`
- `Transaction_Tender`
- `Web_Routing_Ex`

</details>

## Stored procs called

- `NBCUtil_Trace_Status`
- `P_SettlementStatusSet`

## Views referenced

- `VW_MO_ShipHeaderAddress`
- `VW_REPORT_MASTER`
- `VW_TENDER_AUTH`
- `vw_Itm_Master`

## Write statements (verbatim)

### `Catalog_Sales_Header`

```sql
UPDATE Catalog_Sales_Header SET ShipCharge = %.4f WHERE ReceiptID = %d
```

### `ModuleLocking`

```sql
DELETE ModuleLocking WHERE MLID = %d
```

```sql
INSERT INTO ModuleLocking (ModuleID, RecordID, UserName) VALUES (%d, %d, '%s')
```

### `OposLog`

```sql
insert into OposLog (DateTimeStamp, StationName, TranNumber, Message) values (GETDATE(), '%s', '%s', '%s')
```

### `Rental_MO_Xref`

```sql
delete Rental_MO_Xref where trandtlid = %d
```

### `SortHeader`

```sql
delete from SortHeader where GroupId = '%s'
```

### `SystemParameters`

```sql
UPDATE SystemParameters SET ParamValue = '%s' WHERE LocationID = %d AND ParamType = %d
```

```sql
UPDATE SystemParameters SET ParamValue = '%s' WHERE LocationID = %d AND ParamType = %d AND SubGroupingID = %d
```

```sql
Update SystemParameters set ParamValue = '%s' where ParamName = 'Shift4EcomMotoClientAccessToken' and LocationID = %d
```

### `Transaction_Detail`

```sql
update Transaction_Detail set RentalPId = %d where TranDtlID = %d
```

### `Transaction_Header`

```sql
UPDATE Transaction_Header SET ShipCharge = %.4f WHERE TransactionId = %d
```

```sql
update Transaction_Header set TaxTotal = 0.0 where TransactionId = %d
```

```sql
UPDATE Transaction_Header SET Transaction_Header.ShipCharge = %6.3f, Transaction_Header.TaxTotal = %6.3f WHERE Transaction_Header.TransactionId = %d
```

### `Transaction_Tax`

```sql
delete from Transaction_Tax where TransactionId = %d
```

### `Transaction_Tax_Detail`

```sql
delete from Transaction_Tax_Detail where TransactionId = %d
```

### `prism_security`

```sql
delete from prism_security.dbo.UserMap where UMID = %d
```

```sql
update prism_security.dbo.prismuser set Password = '%s' where UserName like '%s'
```

## UI message sample (first 50)

These suggest user-facing features the binary implements.

-     Xmodem message: %s
- ---- Barcode print: (%s) ----
- ---- Bitmap file is (%s) ----
- ---- Bitmap printed (%d:%d) ----
- ---- Bitmap printed (%d:%s:%d:%d) ----
- ---- Bitmap stored in (%d) ----
-  is a Quote and can not be Closed
- !This program cannot be run in DOS mode.
- %s could not be created, open record already exists.
- %s has no items.
- ,Could connect to, but not open the database. An unknown logon error occurred.
- : All or part of the path is invalid.
- : An unspecified error occurred.
- : No error occurred.
- : No further detail available
- : SHARE.EXE was not loaded, or a shared region was locked.
- : The current working directory cannot be removed.
- : The disk is full.
- : The end of file was reached.
- : The file could not be accessed.
- : The file could not be located.
- : The permitted number of open files was exceeded.
- : There are no more directory entries.
- : There was a hardware error.
- : There was an attempt to lock a region that was already locked.
- : There was an attempt to use an invalid file handle.
- : There was an error trying to set the file pointer.
- ? ?$?(?,?0?4?8?<?@?D?H?L?P?T?X?\?`?d?h?l?
- ? ?$?(?,?0?4?8?<?@?D?H?L?P?T?X?\?`?d?h?l?p?t?x?|?
- ? ?$?<?@?X?\?t?x?
- ? ?$?4?8?H?L?\?`?p?t?x?
- ? ?(?@?H?P?h?p?x?
- ? ?(?0?<?D?\?d?l?t?
- ? ?(?0?8?@?L?l?t?|?
- ? ?(?0?T?\?d?p?
- ? ?)?2?>?J?V?b?n?z?
- 2"IDispatch error #%d
- 4Database connection for bulk copy could not be made.
- Abrupt end within tag
- Account length does not meet minimum length.
- Account length exceeds maximum length.
- Account Number is not in BIN Range.
- AES CreateInstance Failed with Error:  0x%X
- All %s items exist on a %s (%s).
- All XRef's for SKU %d have already been returned
- An error has occured while preparing rentals for adoption.
- AR Account is Not Active.
- AR Account Negative.
- AR Amount Charged would be negative.
- Authorize atrium CreateInstance Failed with Error:  0x%X

