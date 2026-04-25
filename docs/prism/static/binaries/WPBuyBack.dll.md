# `WPBuyBack.dll` — static-analysis inventory

- Total extracted strings: **5103**
- Parsed SQL statements: **229**
- Operation breakdown: INSERT=16, UPDATE=16, DELETE=30, SELECT=165, EXEC=2, MERGE=0
- Distinct tables: **74**
- Distinct procs: **4**
- Distinct views: **21**

## Write surface (tables this binary mutates)

| Table | Ops |
|---|---|
| `BookRouting` | SELECT, UPDATE |
| `BookRoutingConfig` | SELECT, UPDATE |
| `BookRoutingConfigTerm` | DELETE, INSERT, SELECT |
| `Bundle_Detail` | DELETE, SELECT |
| `Bundle_DetailItem` | DELETE, SELECT |
| `Bundle_Header` | DELETE, SELECT |
| `Buyback_Buyer_Groups` | DELETE, SELECT |
| `Buyback_Buyer_Location` | DELETE, SELECT |
| `Buyback_Buyers` | DELETE, SELECT |
| `Buyback_Detail` | DELETE, INSERT, SELECT, UPDATE |
| `Buyback_Errors` | DELETE, INSERT, SELECT |
| `Buyback_Header` | SELECT, UPDATE |
| `Buyback_InvRec_Checks` | DELETE, SELECT |
| `Buyback_InvRec_Store` | DELETE, SELECT |
| `Buyback_InvRec_Student` | DELETE, SELECT |
| `Buyback_List_Create` | DELETE, SELECT |
| `Buyback_List_Detail` | DELETE, SELECT, UPDATE |
| `Buyback_List_Header` | DELETE, SELECT, UPDATE |
| `Buyback_List_Item` | DELETE, SELECT, UPDATE |
| `Buyback_New_Item` | DELETE, INSERT, SELECT |
| `buyback_pricetagqueue` | DELETE, SELECT |
| `buyback_pricetagqueueuser` | DELETE, SELECT |
| `Buyback_QuickRef` | DELETE, INSERT, SELECT, UPDATE |
| `buyback_session` | DELETE, SELECT |
| `Buyback_Session_Location` | INSERT, SELECT |
| `Buyback_Session_Purchasers` | SELECT, UPDATE |
| `Buyback_Stolen_Books` | DELETE, SELECT |
| `buyback_workstations` | DELETE, SELECT |
| `Buyers_Guide_Table` | DELETE, SELECT |
| `CR_Locations` | SELECT, UPDATE |
| `EQFunction` | SELECT, UPDATE |
| `GeneralMerchandise` | INSERT, SELECT |
| `Inventory` | INSERT, SELECT |
| `Item` | INSERT, SELECT |
| `Quick` | DELETE, SELECT |

## Read surface (tables/views referenced via SELECT/JOIN only)

<details><summary>39 tables</summary>

- `Acct_Memb_Acct_Cust`
- `Binding`
- `bundle_detailItem`
- `Buyback_Condition`
- `buyback_detail`
- `buyback_header`
- `Buyback_List_detail`
- `Buyback_List_item`
- `Buyback_New_item`
- `Buyback_Purchaser`
- `Buyback_Session`
- `Buyback_Workstations`
- `Buyback_WorkStations`
- `buyers_guide_adopted`
- `Buyers_Guide_table`
- `Buyers_Guide_Vendor_Commission`
- `Buyers_guide_vendors`
- `Buyers_Guide_Vendors`
- `CR_Department`
- `CR_Term`
- `Currency_Exchange`
- `Customer_Address`
- `Customer_Table`
- `dbo`
- `item`
- `ItemMaster`
- `Location`
- `order_decisions`
- `Rental_Detail`
- `Rental_Header_Item_Period`
- `Rental_History`
- `Sequence`
- `Status_Codes`
- `SystemParameters`
- `Tender_Codes_Location`
- `textbook`
- `Textbook`
- `Tradebook`
- `VendorMaster`

</details>

## Stored procs called

- `EmailBuybackReceipt`
- `RentalHistoryReturnBuyBack`
- `SP_BBEXP_REPORTDATA`
- `SP_BBUpdateSouceData`

## Views referenced

- `VW_BBPRICETAGQUEUE`
- `VW_BBSESSIONLOCLIST`
- `VW_BB_BUYER_LOC`
- `VW_BB_BUY_LOC_PRIOR`
- `VW_BB_BUY_PUR`
- `VW_BB_BUY_TOTAL`
- `VW_BB_CLOSE_POST_CHK`
- `VW_BB_COURSE_SRCH`
- `VW_BB_DCC_SRCH`
- `VW_BB_GM_SRCH`
- `VW_BB_INSTRUCTOR_SRCH`
- `VW_BB_ITEM_BUY_LIST`
- `VW_BB_LIST_ORDDEC_EX`
- `VW_BB_LIST_PUR`
- `VW_BB_QREF`
- `VW_BB_QREF_NONE`
- `VW_BB_SESSION_LOC`
- `VW_BB_VENDOR_SRCH`
- `VW_ITM_MASTER`
- `vw_bb_print_choices`
- `vw_bbbuyersessionlocation`

## Write statements (verbatim)

### `BookRouting`

```sql
update BookRouting set RoutingDesc = %s, Priority = %d where BookRoutingId = %d
```

### `BookRoutingConfig`

```sql
update BookRoutingConfig set GroupWholeSalePurchaser = %d, GroupStorePurchaser = %d, DisplayTranSummary = %d, TermUsageType = %d where BookRoutingConfigId = %d
```

### `BookRoutingConfigTerm`

```sql
delete from BookRoutingConfigTerm
```

```sql
insert into BookRoutingConfigTerm (TermID) values (%d)
```

### `Bundle_Detail`

```sql
DELETE FROM Bundle_Detail
```

### `Bundle_DetailItem`

```sql
DELETE FROM Bundle_DetailItem
```

### `Bundle_Header`

```sql
DELETE FROM Bundle_Header
```

### `Buyback_Buyer_Groups`

```sql
delete from Buyback_Buyer_Groups where BuyersGroupID = %ld
```

### `Buyback_Buyer_Location`

```sql
DELETE FROM Buyback_Buyer_Location WHERE BuyersGroupID = %d
```

### `Buyback_Buyers`

```sql
delete from Buyback_Buyers where BuyerID = %ld
```

### `Buyback_Detail`

```sql
DELETE Buyback_Detail WHERE BBReceiptID = %d
```

```sql
insert into Buyback_Detail(BBReceiptId, Qty, Price, tmDate, RentalHId) values(%d, 0, 0, GetDate(), %d)
```

```sql
UPDATE Buyback_Detail SET LocationID = %d WHERE BBDtlID = %d
```

```sql
UPDATE Buyback_Detail SET LocationID = 0 WHERE BBPurchaserID = %d AND fPostedFlg <> 1 and BBItemID = 0
```

```sql
UPDATE Buyback_Detail SET LocationID = 0 WHERE BBPurchaserID = %d AND fPostedFlg <> 1 and BBItemID in (Select BBItemID from Buyback_List_Item where SKU = 0)
```

### `Buyback_Errors`

```sql
DELETE FROM Buyback_Errors WHERE SessionID = %d
```

```sql
INSERT INTO Buyback_Errors (SessionID, Date, ErrorTypeID, DCCID, LocationID) VALUES (%d, '%s', %d, %d, %d)
```

```sql
INSERT INTO Buyback_Errors (SessionID, Date, ErrorTypeID, ISBNCat) VALUES (%d, '%s', %d, '%s')
```

```sql
INSERT INTO Buyback_Errors (SessionID, Date, ErrorTypeID, SKU, LocationID) VALUES (%d, '%s', %d, %d, %d)
```

### `Buyback_Header`

```sql
UPDATE Buyback_Header SET fImportedFlg = 4
```

### `Buyback_InvRec_Checks`

```sql
DELETE FROM Buyback_InvRec_Checks WHERE BBInvRecID IN (SELECT BBInvRecID FROM Buyback_InvRec_Student WHERE SessionID = %d)
```

### `Buyback_InvRec_Store`

```sql
DELETE FROM Buyback_InvRec_Store WHERE SessionID = %d
```

### `Buyback_InvRec_Student`

```sql
DELETE FROM Buyback_InvRec_Student WHERE SessionID = %d
```

### `Buyback_List_Create`

```sql
DELETE FROM Buyback_List_Create WHERE BBUID IN (SELECT BBUID FROM Buyback_List_Header WHERE BBPurchaserID IN (SELECT BBPurchaserID FROM Buyback_Session_Purchasers WHERE SessionID = %d))
```

### `Buyback_List_Detail`

```sql
DELETE FROM Buyback_List_Detail  WHERE fTmpStatus = 0 AND fAutoCreate = 1 AND BoughtQty = 0 AND BBUID = 
```

```sql
DELETE FROM Buyback_List_Detail WHERE BBDetID = %ld
```

```sql
DELETE FROM Buyback_List_Detail WHERE BBUID = %d AND BBItemID = %d
```

```sql
UPDATE Buyback_List_Detail SET fBuyFlg = 1  WHERE fTmpStatus = 0 AND fAutoCreate = 1 AND BoughtQty > 0 AND BBUID = 
```

```sql
UPDATE Buyback_List_Detail SET fNew = 0
```

```sql
UPDATE Buyback_List_Detail SET fTmpStatus = 0 WHERE BBUID = 
```

### `Buyback_List_Header`

```sql
delete from Buyback_List_Header where BBUID = %ld
```

```sql
UPDATE Buyback_List_Header SET fNew = 0
```

### `Buyback_List_Item`

```sql
DELETE FROM Buyback_List_Item WHERE SessionID = %d
```

```sql
UPDATE Buyback_List_Item SET fNew = 0
```

```sql
UPDATE Buyback_List_Item SET KeyCode = NULL WHERE KeyCode = '%s'
```

### `Buyback_New_Item`

```sql
DELETE FROM Buyback_New_Item WHERE SessionID = %d
```

```sql
INSERT INTO Buyback_New_Item (SessionID, ISBNCat, SKU, LocationID, DCCID, UsedDCCID, Cost, Retail, fInventoryOnly) VALUES (%d, '%s', %d, %d, %d, %d, CAST( '$%s' AS MONEY ), CAST( '$%s' AS MONEY ), 1 )
```

```sql
INSERT INTO Buyback_New_Item (SessionID, ISBNCat, SKU, Subsystem, TitleDesc, Author, BindingID, DCCID, UsedDCCID, EdType, CpSize, LocationID, Cost, Retail, fInventoryOnly) VALUES (%d, '%s', %d, %d, '%s', '%s', %d, %d, %d, '%s', '%s', %d, CAST( '$%s' AS MONEY ), CAST( '$%s' AS MONEY ), 0)
```

### `Buyback_QuickRef`

```sql
DELETE Buyback_QuickRef WHERE QRefCode = '%s'
```

```sql
DELETE FROM [Buyback_QuickRef] WHERE [QRefID] = %ld
```

```sql
DELETE FROM [Buyback_QuickRef] WHERE QRefCode = '%s'
```

```sql
DELETE FROM Buyback_QuickRef WHERE QRefID = %s
```

```sql
INSERT INTO [Buyback_QuickRef] ([QRefCode], [ISBN], [AltISBN], [BookKey]) SELECT '%s', [ISBN], [AltISBN], [Bookkey] FROM [Buyers_Guide_Table] WHERE [BGID] = %ld
```

```sql
INSERT INTO [Buyback_QuickRef] ([QRefCode], [SKU], [ISBN], [AltISBN], [BookKey]) SELECT '%s', [SKU], [ISBN], [AltISBN], [Bookkey] FROM [Buyback_List_Item] WHERE [BBItemID] = %ld
```

```sql
INSERT INTO Buyback_QuickRef (QRefCode, SKU, ISBN, AltISBN, BookKey) VALUES('%s', %ld, '%s', '%s', '%s')
```

```sql
INSERT INTO Buyback_QuickRef (QRefCode, SKU, ISBN, AltISBN, BookKey) VALUES('%s', 0, '%s', '%s', '%s')
```

```sql
UPDATE Buyback_QuickRef SET QRefCode = '%d' WHERE QRefID = %s
```

### `Buyback_Session_Location`

```sql
INSERT INTO Buyback_Session_Location (SessionID, LocationID, WarnPercent, TranWarnQty, TranMaxQty, fPrintReceipts, fPrintPriceTags) VALUES (%d, %d, 90, 3, 3, 0, 0)
```

### `Buyback_Session_Purchasers`

```sql
UPDATE Buyback_Session_Purchasers SET CutPer = %.4f WHERE BBPurchaserID = %d
```

### `Buyback_Stolen_Books`

```sql
DELETE FROM Buyback_Stolen_Books WHERE %s
```

### `Buyers_Guide_Table`

```sql
DELETE FROM Buyers_Guide_Table
```

### `CR_Locations`

```sql
UPDATE CR_Locations SET PostingOrder = 99999999 WHERE PostingOrder IS NULL
```

### `EQFunction`

```sql
UPDATE EQFunction SET fAllowUpdates = 0
```

### `GeneralMerchandise`

```sql
INSERT INTO GeneralMerchandise (SKU, Description, Type, Size, CatalogNumber, Color, MfgID) VALUES (%d, '%s', '%s', '%s', '%s', 0, 0)
```

### `Inventory`

```sql
INSERT INTO Inventory (SKU, LocationID, LastSaleDate, LastInventoryDate, Retail, Cost) VALUES (%d, %d, '01/01/1970', '01/01/1970', %s, %s)
```

```sql
INSERT INTO Inventory (SKU, LocationID, LastSaleDate, LastInventoryDate, TaxTypeID, TagTypeID, Retail, Cost) VALUES (%d, %d, '01/01/1970', '01/01/1970', %d, %d, %s, %s)
```

### `Item`

```sql
INSERT INTO Item (SKU, DCCID, VendorID, Subsystem, TypeID, UUID) VALUES (%d, %d, 0, %d, %d, %d)
```

### `Quick`

```sql
Delete Quick Reference Entry?
```

### `buyback_pricetagqueue`

```sql
DELETE FROM buyback_pricetagqueue WHERE SessionID = %d
```

### `buyback_pricetagqueueuser`

```sql
DELETE FROM buyback_pricetagqueueuser WHERE SessionID = %d
```

### `buyback_session`

```sql
delete from buyback_session where sessionid = %ld
```

### `buyback_workstations`

```sql
delete from buyback_workstations where sessionid = %ld
```

## UI message sample (first 50)

These suggest user-facing features the binary implements.

-  AND (VW_BB_LIST_ORDDEC_EX.fWksStatusFlg = 1 or (VW_BB_LIST_ORDDEC_EX.fWksStatusFlg = 2 AND BBDetail.BBDetID is not null ) ) 
-  case when (%f/2) < (ROUND((BuyPrice * %f - FLOOR(BuyPrice *%f)) * 100,0)) %% %f then 
- !This program cannot be run in DOS mode.
- %-4.4s%-3.3s need has been met!
- ) as BBDetail on BBDetail.SKU = VW_BB_LIST_ORDDEC_EX.SKU 
- ? ?$?(?,?0?4?8?<?@?D?H?L?P?T?X?\?`?d?
- ? ?$?(?,?0?4?8?<?@?D?H?L?P?T?X?\?`?d?h?l?p?|?
- ? ?$?(?,?0?4?8?<?@?D?H?L?P?T?X?\?`?d?h?l?p?t?x?|?
- ? ?$?(?,?0?4?8?<?@?D?H?L?X?\?`?d?h?l?p?t?x?|?
- ? ?$?,?0?4?<?T?X?p?
- ? ?$?<?@?X?h?x?
- ? ?&?3?P?_?h?n?t?
- ? ?&?7?>?L?S?a?h?v?}?
- ? ?(?4?<?T?x?
- ? ?/?>?M?T?f?t?
- ? ?@?H?P?X?d?
- ? ?0?@?P?`?p?
- > ?&?C?L?c?u?|?
- > ?(?0?<?\?d?l?t?
- > >$>(>,>0>4>8><>@>D>H>L>0?4?8?<?@?D?H?L?P?T?X?\?`?d?h?l?p?t?x?|?
- A Blank Password is Invalid
- A card number must be entered.
- A name must be entered.
- A phone number must be 10 digits.
- At least one buyer selected to be removed
- At least one group selected to be removed
- balance Bought Qty with Buy Qty.
- BBItemID = ?
- BBPurchaserID = ?
- BBReceiptID = ?
- BBReceiptID = ? and RentalHId is null
- BBUID = ? AND BBItemID = ?
- BBUID = ? AND LocationID = ? AND TermID = ?
- BBUID = ? AND LocationID = ? AND TermID = ? AND BBItemID = ?
- Buyback list is now scheduled to be sent to web.
- BuyerID = ? 
- BuyerID = ? and BuyerLocID = ?
- BuyerLogin = ?
- Buyers Guide not Loaded
- BuyersGroupID = ? 
- Cabinet files(*.cab)|*.cab||
- Can only do a negative buy for this purchaser.
- Cannot create a wholesale record, Buyer Guide vendor has not been set.
- Compacting the database...please wait
- Context sensitive help
- CustomerId = ?
- ERROR : Unable to initialize critical section in CAtlBaseModule
- Exception thrown in destructor
- for this purchaser.
- If this lock is not valid anymore, would you like to clear it?

