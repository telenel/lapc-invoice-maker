# `WPTender.dll` — static-analysis inventory

- Total extracted strings: **2111**
- Parsed SQL statements: **22**
- Operation breakdown: INSERT=0, UPDATE=1, DELETE=0, SELECT=21, EXEC=0, MERGE=0
- Distinct tables: **12**
- Distinct procs: **2**
- Distinct views: **4**

## Write surface (tables this binary mutates)

| Table | Ops |
|---|---|
| `GblComment` | SELECT, UPDATE |

## Read surface (tables/views referenced via SELECT/JOIN only)

<details><summary>11 tables</summary>

- `Acct_Agency`
- `Acct_Agency_Tax_Codes`
- `Customer_Table`
- `POS_Groups`
- `POS_Keyboard_Mappings`
- `POS_Register_Access`
- `POS_Registers`
- `Rental_Setup_POS`
- `Tender_Auth_Types`
- `Tender_Codes_Location`
- `Transaction_Header`

</details>

## Stored procs called

- `RentalHistory`
- `RentalPeriod`

## Views referenced

- `VW_ITM_MASTER`
- `VW_POS_TENDER_LIST`
- `VW_POS_TENDER_TOTALS`
- `VW_TENDER_AUTH`

## Write statements (verbatim)

### `GblComment`

```sql
update GblComment set ModuleID = %d where HeaderID = %d
```

## UI message sample (first 50)

These suggest user-facing features the binary implements.

- !This program cannot be run in DOS mode.
- &Move Selected to Another Tender
- ,Change due is not permitted for this tender. Change due exceeds tender limit.
- ? ?$?(?,?0?4?8?<?@?D?H?L?P?T?X?\?`?d?h?l?p?t?x?|?
- ? ?8?<?T?X?p?t?
- @This Item's DCC is not Valid for this account. Manager Override?
- A Tender cannot be used just for change.
- 'All Items are not completely allocated.
- AR Tender cannot be deleted.
- Are you sure you want to cancel?
- Authentication failed.
- Authorized Tender cannot be deleted.
- Cancelling will cause authorized tenders to be reversed.
- DAn amount over $9,999.99 has been entered.
- Do you want to continue?'Account Number %s is on BAD CHECK LIST.
- DThis Non-Merch Item is not Valid for this account. Manager Override?
- Enter manager's password to continue:
- ERROR : Unable to initialize critical section in CAtlBaseModule
- Error retreiving manager access set: user may not have register access
- Error retreiving manager user set: user may not exist
- Exception thrown in destructor
- fInvalid user name or password.
- Insufficient security rights.
- Invalid tender.
- Is this a rental item?
- Managers Override accepted.\Cannot add Item to this Account, higher priority accounts have not been completely tendered.-Transaction has not been completely tendered.8Credit given to an inactive account. Manager's override?
- Nebraska Book Company, Inc.
- One or more rentals exist for:
- Only %s (%s) or a manager can unlock this terminal.
- Outstanding Amount cannot be negative.
- Outstanding Rentals for 
- Outstanding Rentals for %s
- Passwords are case sensitive, make sure that your caps lock is not on.
- Rental Guaranteed Tender cannot be deleted.
- Tender has been authorized, this transaction must be completed.
- Tender not found
- This item is not an approved textbook for this student and account. Manager Override?
- This terminal has been locked.
- TransactionID = ?
- TransactionID = ? and TranTenderID = ?
- Unable to fully allocate tax amount to items.

