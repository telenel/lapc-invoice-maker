# `WPInv.dll` — static-analysis inventory

- Total extracted strings: **2770**
- Parsed SQL statements: **53**
- Operation breakdown: INSERT=0, UPDATE=3, DELETE=2, SELECT=48, EXEC=0, MERGE=0
- Distinct tables: **21**
- Distinct procs: **0**
- Distinct views: **7**

## Write surface (tables this binary mutates)

| Table | Ops |
|---|---|
| `Discrepancy` | DELETE, SELECT |
| `Freight_Invoice_Detail` | DELETE, SELECT |
| `Invoice_Detail` | SELECT, UPDATE |
| `Invoice_Location` | SELECT, UPDATE |
| `VendorParameters` | SELECT, UPDATE |

## Read surface (tables/views referenced via SELECT/JOIN only)

<details><summary>16 tables</summary>

- `AddressType`
- `buyers_guide_vendors`
- `CD_AcctReasons`
- `CD_Reasons`
- `Freight_Invoice_Header`
- `invoice_detail`
- `Invoice_Header`
- `Item`
- `ItemMaster`
- `Location`
- `prism_security`
- `QuickSearchType`
- `ShipVia`
- `Status_Codes`
- `Subsystem_Table`
- `VendorMaster`

</details>

## Stored procs called

_None detected._

## Views referenced

- `VW_DCCGLCODE`
- `VW_FREIGHT_INV_NAVIGATOR`
- `VW_INVC_DETAIL_GRID`
- `VW_INVC_DISCR`
- `VW_INVC_Discr_Credit_Memos`
- `VW_INVC_NAVIGATOR`
- `VW_INVC_PODETAIL`

## Write statements (verbatim)

### `Discrepancy`

```sql
Delete Discrepancy (Del)
```

### `Freight_Invoice_Detail`

```sql
DELETE FROM Freight_Invoice_Detail WHERE FRINVDID = %ld
```

### `Invoice_Detail`

```sql
update Invoice_Detail set Retail = %.4f where Invduid = %d
```

### `Invoice_Location`

```sql
update Invoice_Location set Royalty = %.4f where Invluid = %d
```

### `VendorParameters`

```sql
UPDATE dbo.VendorParameters SET MaxReturnTime = %ld WHERE VendorID = %ld AND Subsystem = %d
```

## UI message sample (first 50)

These suggest user-facing features the binary implements.

- !This program cannot be run in DOS mode.
- ? ?$?(?,?0?4?8?<?@?D?H?L?P?T?X?\?`?d?h?l?p?t?x?|?
- ? ?&?,?2?8?>?D?J?P?V?\?b?h?n?t?z?
- ? ?(?0?8?T?\?d?p?x?
- ? ?)?A?F?o?x?
- ? ?/?>?T?e?n?
- A discrepancy already exists for the selected reason.
- Cannot add a duplicate invoice for this vendor.
- Detail records need to exist before posting.
- Discount can not be greater than $ %.2f
- Discrepancy cannot be deleted because it's on a Credit Memo
- DSCHID = %ld AND fType in (2,4)
- ERROR : Unable to initialize critical section in CAtlBaseModule
- Exception thrown in destructor
- FRINVHID = ? and FRINVDID = ?
- Invoice '%s' already exists for Vendor '%s.'  
- Invoice detail(s) cannot be deleted because a discrepancy has been resolved on a Credit Memo
- InvoiceID = ?
- InvoiceID = ? AND INVDUID = ?
- InvoiceID = ? AND Subsystem = ?
- Nebraska Book Company, Inc.
- No detail records exist for allocation.
- No details exist with value.
- Not All Credits are allocated.
- Not All Fees are allocated.
- Not All Freight is allocated.
- The amount must be greater than 0.
- The quantity must be greater than 0.
- VendorID = ?

