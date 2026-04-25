# `WPCredit.dll` — static-analysis inventory

- Total extracted strings: **2050**
- Parsed SQL statements: **15**
- Operation breakdown: INSERT=1, UPDATE=0, DELETE=0, SELECT=14, EXEC=0, MERGE=0
- Distinct tables: **7**
- Distinct procs: **1**
- Distinct views: **3**

## Write surface (tables this binary mutates)

_None detected._

## Read surface (tables/views referenced via SELECT/JOIN only)

<details><summary>7 tables</summary>

- `Credit_Resolved_Detail`
- `CRT_Detail`
- `CRT_Header`
- `Invoice_Location`
- `status_codes`
- `Status_Codes`
- `VendorParameters`

</details>

## Stored procs called

- `NBC_Rebate_Crd2`

## Views referenced

- `VW_MCRED_HEADER`
- `VW_MCRED_NAV`
- `VW_RCRED_NAV`

## UI message sample (first 50)

These suggest user-facing features the binary implements.

- !This program cannot be run in DOS mode.
- ? ?$?(?,?0?4?8?<?@?D?H?L?P?T?X?\?`?d?h?l?p?t?x?|?
- ? ?$?(?,?0?D?H?`?d?|?
- ? ?(?4?T?\?h?p?
- A resolved quantity can only be entered when credit has been received.
- A resolved quantity Must be entered when credit has been received.
- All locations for this request already have a postage record.
- Buyer's Guide not currently supported
- Can only cancel what has not be resolved.
- Cancel this credit request?
- ERROR : Unable to initialize critical section in CAtlBaseModule
- Exception thrown in destructor
- HeaderID = %d and fType = %d
- headerid = ? and fType = ?
- Item was cancelled in a previous period, it cannot be changed.
- Item was denied in a previous period, it cannot be changed.
- Nebraska Book Company, Inc.
- Request was posted in a previous period, it cannot be reversed.
- RequestHdrID = ?
- Resolved plus denied cannot exceed the requested quantity.
- Unable to read return Serial Numbered detail
- Unable to reverse request.  This request has already been sent to NBC.
- Unable to reverse request.  This request has already been transmitted.
- Undo cancelled quantities on this credit request?
- Use cancelled quantity if needed.

