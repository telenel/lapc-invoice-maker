# `WPData.dll` — static-analysis inventory

- Total extracted strings: **5647**
- Parsed SQL statements: **1**
- Operation breakdown: INSERT=0, UPDATE=1, DELETE=0, SELECT=0, EXEC=0, MERGE=0
- Distinct tables: **1**
- Distinct procs: **2**
- Distinct views: **0**

## Write surface (tables this binary mutates)

| Table | Ops |
|---|---|
| `DccLocationRoyaltySet_vw` | SELECT, UPDATE |

## Read surface (tables/views referenced via SELECT/JOIN only)

_None detected._

## Stored procs called

- `RoyaltyMinimum`
- `RoyaltyPercentage`

## Views referenced

_None detected._

## Write statements (verbatim)

### `DccLocationRoyaltySet_vw`

```sql
update DccLocationRoyaltySet_vw set 
```

## UI message sample (first 50)

These suggest user-facing features the binary implements.

- !This program cannot be run in DOS mode.
- (BuyerLocID = ? and PurchaserLocID = ? and PurchaserID = ? and sku = ?)
- (SessionID = ? and BuyerLocID = ? and PurchaserLocID = ? and PurchaserID = ? and sku = ? and fPrinted = ?)
- ? ?$?(?,?0?4?8?<?@?D?H?L?P?T?X?\?`?d?h?l?p?
- ? ?$?(?,?0?4?8?<?@?D?H?L?P?T?X?\?`?d?h?l?p?t?x?|?
- ? ?0?4?8?<?@?H?`?p?
- ? ?6?=?S?Z?p?u?
- ApplicationID = ? and TargetID = ? and fTargetType = ?
- ApplicationID = ? and TargetID = ? and SourceID = ? and fQSType = ?
- CR_Detail.CourseReqID = ? AND SKU = ?
- customerid = ?
- customerid = ? and fBillAddr = ?
- customerid = ? and locationid = ?
- DatasetID = ? OR GroupDesc = ?
- DigitalTxtID = ?
- ERROR : Unable to initialize critical section in CAtlBaseModule
- FixtureAreaID = ?
- GroupingID = ? AND LocationID = ?
- InstructorID = ?
- LocationID = ?
- LocationID = ? AND fOpenFlg <> ? AND CampusID = ?
- LocationID = ? AND SequenceTypeID = ? AND SequenceNumber = ?
- LocationID = ? AND TermID = ?
- MediaSetID = ?
- MODiscTypeID = ?
- ModuleID = ?
- ModuleID = ? and UserID = ?
- Nebraska Book Company, Inc.
- packageid = ?
- packageid = ? and packagedid = ?
- ProbNotifyID = ? AND SKU = ?
- PurchAddCfgID = ?
- ShipCodeID = ? and LocationID = ?
- SKU = ? AND LocationID = ?
- SortOrder asc
- StyleGraphicID = ?
- StyleLocationID = ?
- UUID = ? AND Subsystem = ?
- UUID = ? AND Subsystem = ? AND SKU = ?
- VendorID = ?
- VendorID = ? AND AddressGroupID = ? AND AddressID = ? AND SubSystem = ?
- VendorID = ? AND Subsystem = ?

