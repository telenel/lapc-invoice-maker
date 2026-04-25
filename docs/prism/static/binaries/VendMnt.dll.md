# `VendMnt.dll` — static-analysis inventory

- Total extracted strings: **1786**
- Parsed SQL statements: **25**
- Operation breakdown: INSERT=0, UPDATE=0, DELETE=1, SELECT=23, EXEC=1, MERGE=0
- Distinct tables: **15**
- Distinct procs: **1**
- Distinct views: **0**

## Write surface (tables this binary mutates)

| Table | Ops |
|---|---|
| `vendormaster` | DELETE, SELECT |

## Read surface (tables/views referenced via SELECT/JOIN only)

<details><summary>14 tables</summary>

- `AddressType`
- `Currency_Exchange`
- `Location`
- `prism_security`
- `pubnet_code`
- `ReturnPolicy`
- `ShipVia`
- `Subsystem_Table`
- `VendorAddressGroups`
- `VendorLocation`
- `VendorMaster`
- `VendorOrderingMethod`
- `VendorPubnetCode`
- `VendorTypes`

</details>

## Stored procs called

- `ResendMagicVendorColorSize`

## Views referenced

_None detected._

## Write statements (verbatim)

### `vendormaster`

```sql
delete from vendormaster where vendorid = %ld
```

## UI message sample (first 50)

These suggest user-facing features the binary implements.

- !This program cannot be run in DOS mode.
- ? ?$?(?,?0?4?8?<?@?D?H?L?P?T?X?\?`?d?h?l?p?t?x?|?
- ? ?&?,?2?8?>?D?J?P?V?\?b?h?n?t?z?
- ? ?0?T?\?d?l?t?|?
- Are you sure you want to set '%s' (%s) to default?
- Code cannot be empty
- Discount percentage/dollar must be bigger then zero
- ERROR : Unable to initialize critical section in CAtlBaseModule
- Exception thrown in destructor
- High value must be > %ld and < %ld
- Important!  Vendor Currency change does NOT change historical documents.
- Imprint cannot be blank
- Imprint prefix cannot be blank
- Low value must be > %ld and < %ld
- Nebraska Book Company, Inc.
- Percentage must be <= 100%
- ResendMagicVendorColorSize transaction has failed!
- System Error: Unable to generate unique vendor code
- System Error: Unable to initialize address group combo box
- System Error: Unable to initialize address tab control
- System Error: Unable to initialize Buyer combobox
- System Error: Unable to initialize currency combobox
- System Error: Unable to initialize min order
- System Error: Unable to initialize pubnet code combobox
- System Error: Unable to initialize return policy combobox
- System Error: Unable to initialize subsystem combo box
- System Error: Unable to initialize subsystem combobox
- System Error: Unable to initialize terms %
- System Error: Unable to initialize vendor preferred ordering method combobox
- System Error: Unable to initialize vendor type combobox
- System Error: Vendor code wraparound
- The code cannot be empty
- The Colors and Sizes have been resent
- The discount range low=%d, high=%d conflits with another range
- The low and high value cannot be empty
- The low and high value cannot be negative
- The low value must be lower then high value
- The percentage cannot be empty
- The percentage is out of acceptable range
- The Selected ShipVia Value is Already Used.  Please Selected a Different Shipping Method.
- Unknown location
- Vendor Record has dependent data (Cannot Be Deleted).
- Vendor: '%s' (%s) is the current Digital Content Mass Adoption default Vendor.
- VendorID = ?
- VendorID = ? AND BuyerID = ?
- You must enter at least one vendor.

