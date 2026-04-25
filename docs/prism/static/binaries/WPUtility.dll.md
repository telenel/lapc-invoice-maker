# `WPUtility.dll` — static-analysis inventory

- Total extracted strings: **17707**
- Parsed SQL statements: **400**
- Operation breakdown: INSERT=10, UPDATE=47, DELETE=32, SELECT=301, EXEC=9, MERGE=1
- Distinct tables: **151**
- Distinct procs: **10**
- Distinct views: **42**

## Write surface (tables this binary mutates)

| Table | Ops |
|---|---|
| `bip_temp` | DELETE, INSERT, SELECT, UPDATE |
| `BIP_Temp` | INSERT, SELECT |
| `Buyback_Detail` | SELECT, UPDATE |
| `buyback_pricetagqueue` | DELETE, SELECT, UPDATE |
| `CD_Reasons` | SELECT, UPDATE |
| `CMD_SalesEventItems_Delete` | DELETE, SELECT |
| `Color` | SELECT, UPDATE |
| `Course_Selection` | DELETE, INSERT, SELECT, UPDATE |
| `Current` | DELETE, SELECT |
| `customer_location` | DELETE, SELECT |
| `DCC_Selection` | DELETE, INSERT, SELECT, UPDATE |
| `EmailTemplate` | DELETE, SELECT |
| `EQListData` | DELETE, SELECT |
| `GMSize` | SELECT, UPDATE |
| `Item_Xref_Dups` | DELETE, SELECT |
| `itemmaster` | SELECT, UPDATE |
| `ItemSeasonCodes` | SELECT, UPDATE |
| `LocationSelectionLocations` | DELETE, SELECT |
| `LocationSelections` | DELETE, SELECT, UPDATE |
| `OutgoingMessages` | INSERT, SELECT |
| `PO_Style_Location_Components` | SELECT, UPDATE |
| `prism_security` | DELETE, SELECT |
| `Problem_Notifications_Reasons` | SELECT, UPDATE |
| `Purch_AddConfig_Location` | DELETE, SELECT |
| `Report_SaveParams_Course` | DELETE, INSERT, SELECT |
| `Report_SaveParams_DCC` | DELETE, INSERT, SELECT |
| `ReportGenGroup` | DELETE, SELECT |
| `ReportGenGroupSummary` | DELETE, SELECT |
| `ReportLogo` | SELECT, UPDATE |
| `ReportSelectionValue` | INSERT, SELECT |
| `SalesEventItemLocations` | SELECT, UPDATE |
| `SalesEvents` | DELETE, SELECT |
| `selected` | DELETE, SELECT |
| `SerialNumberDetail` | DELETE, SELECT, UPDATE |
| `SerialNumberHeader` | INSERT, SELECT |
| `Size` | DELETE, SELECT |
| `Stock_Adjustment_Table` | INSERT, SELECT |
| `StockAdjustReason` | DELETE, SELECT |
| `systemlog` | DELETE, SELECT |
| `TermCondition` | SELECT, UPDATE |
| `Textbook` | SELECT, UPDATE |
| `the` | DELETE, SELECT, UPDATE |
| `this` | DELETE, SELECT |
| `Tradebook` | SELECT, UPDATE |
| `VendorDiscountCodes` | SELECT, UPDATE |

## Read surface (tables/views referenced via SELECT/JOIN only)

<details><summary>106 tables</summary>

- `acct_apply`
- `Acct_Financial_Category_Type`
- `binding`
- `Binding`
- `Buyback_List_Item`
- `Buyers_Guide_Adopted`
- `Buyers_Guide_Table`
- `Buyers_Guide_Vendors`
- `catalog_sales_Header`
- `Catalog_Sales_Header`
- `catalog_sales_tender`
- `CatalogItems`
- `CD_Detail`
- `CD_Header`
- `CR_Course`
- `CR_Department`
- `CR_Header`
- `CR_Locations`
- `CR_Locations_Detail`
- `CR_Term`
- `CRT_Header`
- `Currency_Exchange`
- `customer_address`
- `customer_table`
- `Customer_Table`
- `DCC_Category`
- `DCC_Class`
- `DCC_Department`
- `DeptClassCat`
- `EQFunction`
- `GeneralMerchandise`
- `Inventory`
- `InventoryStatusCodes`
- `Invoice_Location`
- `Item`
- `Item_XRef_Dups`
- `ItemFindSettings`
- `Location`
- `Location_Grouping`
- `Location_Groups`
- `LocationSelectionViews`
- `Mathews_books`
- `Mathews_Books`
- `Matrix_Detail`
- `Matrix_Header`
- `MediaDisplayTypes`
- `MediaTypes`
- `mo_discount_codes`
- `MT_Header`
- `MT_HEADER`
- `outgoingmessages`
- `PackageDetail`
- `PackageHeader`
- `packagestockadjustcode`
- `PO_Detail`
- `PO_Header`
- `PO_Location`
- `pos_device`
- `POS_Receipt_Types`
- `POS_SetUP`
- `PriceModificationRoundingDirections`
- `PriceModificationRoundingTargets`
- `Purch_AddConfig`
- `QuickSearchType`
- `Reason_Code`
- `Recurrence_Ordinals`
- `Recurrence_Patterns`
- `rental_history`
- `Report_SaveParams_Detail`
- `Report_SaveParams_Header`
- `ReportCustom`
- `ReportGenHeader`
- `ReportGenTemplate`
- `ReportHeaderColor`
- `ReportMaster`
- `ReportSortOptions`
- `SalesEventAux`
- `SalesEventItems`
- `Sequence`
- `Sequence_Type`
- `ShipVia`
- `State_Code`
- `Status_Codes`
- `StockAdjustReason_vw`
- `Store_Information_Table`
- `Style_Location_Components`
- `Style_Locations`
- `Subsystem_Table`
- `sysobjects`
- `SystemParameters`
- `TagType`
- `TagTypePrinter`
- `Tender_Codes`
- `transaction_detail`
- `Transaction_Detail`
- `transaction_header`
- `Transaction_Header`
- `Transaction_Tender`
- `vendoraddress`
- `VendorAddressGroups`
- `vendorisbn`
- `VendorISBN`
- `vendormaster`
- `VendorMaster`
- `VendorOrderingMethod`
- `VendorParameters`

</details>

## Stored procs called

- `E_ArtInstructions_Delete`
- `E_GraphicComponentType_Delete`
- `E_GraphicComponent_Delete`
- `E_LocationSelection_SetUserDefault`
- `E_LocationSelection_Update`
- `E_StyleGraphics_Delete`
- `InventoryStatusCodes`
- `P_GMSize_SortTo`
- `P_Media_UpdateSortOrder`
- `P_ShelfLocation_Delete`

## Views referenced

- `VW_CRS`
- `VW_CR_LOCATIONS_TERM`
- `VW_CourseSavedSelections`
- `VW_DCCITEMTAXTYPE`
- `VW_DCC_LOOKUP`
- `VW_DaysOfWeek`
- `VW_DccSavedSelections`
- `VW_EQ2_INVENTORY`
- `VW_EQ2_SALE`
- `VW_FISC_INV_POST`
- `VW_GraphicComponentTags`
- `VW_IFF_BG`
- `VW_IFF_BIP`
- `VW_IFF_CR_GM`
- `VW_IFF_CR_PKG`
- `VW_IFF_CR_TEXT`
- `VW_IFF_CR_TRADE`
- `VW_IFF_GM`
- `VW_IFF_MAT`
- `VW_IFF_PKG`
- `VW_IFF_TEXT`
- `VW_IFF_TRADE`
- `VW_ITM_BARCODE`
- `VW_ITM_INVENTORY`
- `VW_ITM_MASTER`
- `VW_LOCATION_REGIONS`
- `VW_LongDescriptions`
- `VW_MENU_SEC_LOCATIONS`
- `VW_MO_SHIPCODE_HEADER`
- `VW_Media_CollectiveName`
- `VW_Months`
- `VW_PO_STYLE_LOCATION_COMPONENTS`
- `VW_PO_STYLE_LOCATION_SKUS`
- `VW_PriceModificationDescriptions`
- `VW_REPORT_MASTER`
- `VW_SEASON_CODES`
- `VW_SHELF_LOCATIONS`
- `VW_STYLES`
- `VW_STYLE_LOCATION_COMPONENTS`
- `VW_STYLE_SKUS`
- `VW_SYSLOG_NAVIGATOR`
- `VW_Status_Codes`

## Write statements (verbatim)

### `BIP_Temp`

```sql
insert into BIP_Temp (queryid, sku, typeid, descr, sys, impmfg, bdtyp, edcolor, cpsize, isbncat, vendor, price, author, title, bookkey) values (%ld, 0, 1, '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s')
```

### `Buyback_Detail`

```sql
UPDATE Buyback_Detail SET LocationID = %d WHERE BBPurchaserID = %d AND fPostedFlg <> 1 and BBItemID in (Select BBItemID from Buyback_List_Item where SKU = 0 and BOOKKEY = '%s' AND ISBN = '%s')
```

```sql
UPDATE Buyback_Detail SET LocationID = %d WHERE BBPurchaserID = %d AND fPostedFlg <> 1 AND BOOKKEY = '%s' AND ISBN = '%s'
```

### `CD_Reasons`

```sql
UPDATE CD_Reasons SET fDisable = 0 WHERE ReasonText = '%s'
```

```sql
UPDATE CD_Reasons SET fDisable = 1 WHERE ReasonID = %d
```

### `CMD_SalesEventItems_Delete`

```sql
DELETE CMD_SalesEventItems_Delete WHERE SalesEventItemID IN (
```

### `Color`

```sql
UPDATE Color SET fDisable = 1 WHERE ColorID = %d
```

### `Course_Selection`

```sql
DELETE Course_Selection WHERE CrsSelGrpID = %d 
```

```sql
INSERT INTO Course_Selection (CrsSelGrpID, CrsID, Mask, TermID) VALUES (%d, %d, %d, %d) 
```

```sql
UPDATE Course_Selection SET CrsSelGrpID = CrsSelID WHERE CrsSelID = %d 
```

### `Current`

```sql
Delete Current Report Generator Record?
```

### `DCC_Selection`

```sql
DELETE DCC_Selection WHERE DCCSelGrpID = %d 
```

```sql
INSERT INTO DCC_Selection (DCCSelGrpID, DCCID, DCCMask, Department, Class) VALUES (%d, %d, %d, %d, %d) 
```

```sql
UPDATE DCC_Selection SET DCCSelGrpID = DCCSelID WHERE DCCSelID = %d 
```

### `EQListData`

```sql
delete from EQListData where EQListId = %d
```

### `EmailTemplate`

```sql
delete EmailTemplate where EmailTemplate = 
```

### `GMSize`

```sql
UPDATE GMSize SET fDisable = 0 WHERE Description = '%s'
```

```sql
UPDATE GMSize SET fDisable = 1 WHERE SizeID = %d
```

### `ItemSeasonCodes`

```sql
UPDATE ItemSeasonCodes SET bDeleted = 1 WHERE ItemSeasonCodeID = 
```

### `Item_Xref_Dups`

```sql
DELETE FROM Item_Xref_Dups WHERE Barcode = '%s' AND SKU <> %ld
```

```sql
DELETE FROM Item_Xref_Dups WHERE Barcode = '%s' AND SKU <> %ld AND SKU <> %ld
```

### `LocationSelectionLocations`

```sql
DELETE LocationSelectionLocations WHERE LocationSelectionID = 
```

### `LocationSelections`

```sql
DELETE LocationSelections WHERE LocationSelectionID = 
```

```sql
UPDATE LocationSelections SET LocationSelectionViewID = %d WHERE LocationSelectionID = %d
```

### `OutgoingMessages`

```sql
INSERT INTO OutgoingMessages (MsgType, MsgSubType, Status, POorWantListID, CreatedDate, ScheduledDate, LocationID, fHistory, fMergedLoc) SELECT DISTINCT 1, 2, 1, %ld, GETDATE(), GETDATE(), PO_Location.LocationID, 0, 0 FROM PO_Location, PO_Detail WHERE PO_Location.POD_ID = PO_Detail.POD_ID AND PO_Detail.POID = %ld
```

### `PO_Style_Location_Components`

```sql
update PO_Style_Location_Components set GraphicComponentID=%d where POID=%d and StyleLocationComponentID=%d
```

### `Problem_Notifications_Reasons`

```sql
UPDATE dbo.Problem_Notifications_Reasons SET fDisable = 0 WHERE Name = '%s'
```

```sql
UPDATE dbo.Problem_Notifications_Reasons SET fDisable = 1 WHERE ReasonID = %d
```

### `Purch_AddConfig_Location`

```sql
delete from Purch_AddConfig_Location where PurchAddCfgID = %ld
```

### `ReportGenGroup`

```sql
delete from ReportGenGroup where RGGID = %d
```

### `ReportGenGroupSummary`

```sql
delete from ReportGenGroupSummary where RGGID = %d
```

### `ReportLogo`

```sql
UPDATE ReportLogo SET fDeleted = 1, Description = '' WHERE ReportLogoID = %d
```

### `ReportSelectionValue`

```sql
insert into ReportSelectionValue(ReportSelectionId, Value) values(%d, %d)
```

### `Report_SaveParams_Course`

```sql
delete from Report_SaveParams_Course where RSPDID = %d
```

```sql
insert into Report_SaveParams_Course (RSPDID, CourseId, Mask, TermId) values(%d, %d, %d, %d)
```

### `Report_SaveParams_DCC`

```sql
delete from Report_SaveParams_DCC where RSPDID = %d
```

```sql
insert into Report_SaveParams_DCC (RSPDID, DCCID, DCCIDMask) values(%d, %d, %d)
```

### `SalesEventItemLocations`

```sql
update SalesEventItemLocations set SalePriceOverride = NULL where SalesEventItemLocationID in (%s)
```

### `SalesEvents`

```sql
DELETE SalesEvents WHERE SalesEventID = 
```

### `SerialNumberDetail`

```sql
DELETE FROM SerialNumberDetail WHERE SerialDID = %ld
```

```sql
DELETE SerialNumberDetail WHERE SerialDID = %d 
```

```sql
update SerialNumberDetail set Price = %.2f where SerialID = %ld 
```

```sql
UPDATE SerialNumberDetail SET SerialNumberDetail.CustomerID =  NULL, SerialNumberDetail.SaleDate = NULL, SerialNumberDetail.TrackingID = NULL, SerialNumberDetail.fTrackingType = NULL WHERE SerialNumberDetail.SerialDID = %d
```

```sql
UPDATE SerialNumberDetail SET SerialNumberDetail.CustomerID = 0, SerialNumberDetail.SaleDate = GetDate() WHERE SerialNumberDetail.SerialDID = %d
```

```sql
UPDATE SerialNumberDetail SET SerialNumberDetail.CustomerID = 0, SerialNumberDetail.SaleDate = GetDate(), SerialNumberDetail.TrackingID = CD_Header.CDUID, SerialNumberDetail.fTrackingType = %d FROM CD_Header WHERE SerialNumberDetail.SerialDID = %d AND CD_Header.CDUID = %d
```

```sql
UPDATE SerialNumberDetail SET SerialNumberDetail.CustomerID = 0, SerialNumberDetail.SaleDate = GetDate(), SerialNumberDetail.TrackingID = CRT_Header.CRTUID, SerialNumberDetail.fTrackingType = %d FROM CRT_Header WHERE SerialNumberDetail.SerialDID = %d AND CRT_Header.CRTUID = %d
```

```sql
UPDATE SerialNumberDetail SET SerialNumberDetail.CustomerID = Catalog_Sales_Header.CustomerID, SerialNumberDetail.SaleDate = %s, SerialNumberDetail.WarrantyExpDate = %s, SerialNumberDetail.TrackingID = Catalog_Sales_Header.ReceiptID, SerialNumberDetail.fTrackingType = %d FROM Catalog_Sales_Header WHERE SerialNumberDetail.SerialDID = %d AND Catalog_Sales_Header.ReceiptID = %d
```

```sql
UPDATE SerialNumberDetail SET SerialNumberDetail.CustomerID = NULL, SerialNumberDetail.ReceiveDate = GetDate() WHERE SerialNumberDetail.SerialDID = %ld 
```

```sql
UPDATE SerialNumberDetail SET SerialNumberDetail.CustomerID = NULL, SerialNumberDetail.ReceiveDate = GetDate(), SerialNumberDetail.TrackingID = PO_Header.POID, SerialNumberDetail.fTrackingType = %d FROM PO_Header WHERE SerialNumberDetail.SerialDID = %ld AND PO_Header.POID = %ld
```

```sql
UPDATE SerialNumberDetail SET SerialNumberDetail.CustomerID = Transaction_Header.CustomerID, SerialNumberDetail.SaleDate = %s, SerialNumberDetail.WarrantyExpDate = %s, SerialNumberDetail.TrackingID = Transaction_Header.MOReceiptID, SerialNumberDetail.fTrackingType = %d, SerialNumberDetail.TranDtlID = %ld FROM Transaction_Header WHERE SerialNumberDetail.SerialDID = %d AND Transaction_Header.TransactionId = %d
```

```sql
UPDATE SerialNumberDetail SET SerialNumberDetail.ReceiveDate = GetDate(), SerialNumberDetail.SaleDate = '%s', SerialNumberDetail.TrackingID = MT_Header.MTUID, SerialNumberDetail.fTrackingType = %d FROM MT_Header WHERE SerialNumberDetail.SerialDID = %d AND MT_Header.MTUID = %d
```

```sql
UPDATE SerialNumberDetail SET SerialNumberDetail.TranDtlID =  NULL, SerialNumberDetail.CustomerID =  NULL, SerialNumberDetail.SaleDate = '%s', SerialNumberDetail.WarrantyExpDate = '%s', SerialNumberDetail.TrackingID = 0, SerialNumberDetail.fTrackingType = 0 WHERE SerialNumberDetail.SerialDID = %d
```

```sql
update SerialNumberDetail set TranDtlID = %ld where SerialID = %ld AND CustomerID = %ld AND TrackingID = %ld AND fTrackingType = %d
```

### `SerialNumberHeader`

```sql
INSERT INTO SerialNumberHeader (LocationID, SKU, Description, ProductIDCode, WarrantyID, WarrantyDays, fRental, POSPrice, Template, KeepUntil) values(%d, %d, '%s', %d, %d, %d, %d, %f, '%s', '%s')
```

### `Size`

```sql
Delete Size
```

### `StockAdjustReason`

```sql
delete from StockAdjustReason where StockAdjReasonID=%d
```

### `Stock_Adjustment_Table`

```sql
INSERT INTO dbo.Stock_Adjustment_Table (Stock_Adjustment_Table.SKU, Stock_Adjustment_Table.LocationID, Stock_Adjustment_Table.UserID, Stock_Adjustment_Table.ModuleID, Stock_Adjustment_Table.ReasonID, Stock_Adjustment_Table.Qty, Stock_Adjustment_Table.AdjDate) VALUES (%ld, %ld, %ld, %d, %ld, %ld, '%0.2d/%0.2d/%0.2d %0.2d:%0.2d:%0.2d')
```

### `TermCondition`

```sql
update TermCondition set Text = '%s' where TCTId = %d
```

### `Textbook`

```sql
UPDATE Textbook SET Textbook.ISBN = BIP_Temp.ISBNCat, Textbook.Author = BIP_Temp.Author, Textbook.Title = '%s', Textbook.Edition = BIP_Temp.EdColor, Textbook.Copyright = BIP_Temp.CpSize, Textbook.Imprint = BIP_Temp.ImpMfg, Textbook.BindingID = %d FROM BIP_Temp WHERE Textbook.TXUID = %d AND BIP_Temp.BPUID = %d
```

```sql
UPDATE Textbook SET Textbook.ISBN = Buyers_Guide_Table.ISBN, Textbook.Author = Buyers_Guide_Table.Author, Textbook.Title = Buyers_Guide_Table.Title, Textbook.Edition = Buyers_Guide_Table.Edition, Textbook.Copyright = Buyers_Guide_Table.Copyright, Textbook.Imprint = Buyers_Guide_Table.Imprint, Textbook.BindingID = %d FROM Buyers_Guide_Table WHERE Textbook.TXUID = %d AND Buyers_Guide_Table.Bookkey = '%s'
```

```sql
UPDATE Textbook SET Textbook.ISBN = Mathews_Books.ISBN, Textbook.Author = Mathews_Books.Author, Textbook.Title = Mathews_Books.Title, Textbook.Edition = Mathews_Books.Edition, Textbook.Copyright = Mathews_Books.Copyright, Textbook.Imprint = Mathews_Books.Imprint, Textbook.BindingID = %d FROM Mathews_Books WHERE Textbook.TXUID = %d AND Mathews_Books.BookID = '%s'
```

```sql
UPDATE Textbook SET Textbook.ISBN = Tradebook.ISBN, Textbook.Author = Tradebook.Author, Textbook.Title = Tradebook.Title, Textbook.Edition = Tradebook.Edition, Textbook.Copyright = Tradebook.Copyright, Textbook.Imprint = Tradebook.Imprint, Textbook.BindingID = %d FROM Tradebook WHERE Textbook.TXUID = %d AND Tradebook.SKU = %d
```

### `Tradebook`

```sql
UPDATE Tradebook SET Tradebook.ISBN = BIP_Temp.ISBNCat, Tradebook.Author = BIP_Temp.Author, Tradebook.Title = '%s', Tradebook.Edition = BIP_Temp.EdColor, Tradebook.Copyright = BIP_Temp.CpSize, Tradebook.Imprint = BIP_Temp.ImpMfg, Tradebook.BindingID = %d FROM BIP_Temp WHERE Tradebook.TRUID = %d AND BIP_Temp.BPUID = %d
```

```sql
UPDATE Tradebook SET Tradebook.ISBN = Mathews_Books.ISBN, Tradebook.Author = Mathews_Books.Author, Tradebook.Title = Mathews_Books.Title, Tradebook.Edition = Mathews_Books.Edition, Tradebook.Copyright = Mathews_Books.Copyright, Tradebook.Imprint = Mathews_Books.Imprint, Tradebook.BindingID = %d FROM Mathews_Books WHERE Tradebook.TRUID = %d AND Mathews_Books.MBID = %d
```

### `VW_PO_STYLE_LOCATION_COMPONENTS`

```sql
UPDATE VW_PO_STYLE_LOCATION_COMPONENTS SET GraphicComponentID = DefaultGraphicComponentID WHERE StyleLocationID = %d AND POID = %d
```

### `VW_STYLE_LOCATION_COMPONENTS`

```sql
UPDATE VW_STYLE_LOCATION_COMPONENTS SET GraphicComponentID = DefaultGraphicComponentID WHERE StyleLocationID = %d
```

### `VendorDiscountCodes`

```sql
UPDATE dbo.VendorDiscountCodes SET fDisable = 0 WHERE DiscCode = '%s' AND VendorID = %ld AND Subsystem = %d
```

```sql
UPDATE dbo.VendorDiscountCodes SET fDisable = 1 WHERE DiscCodeID = %d
```

### `bip_temp`

```sql
delete from bip_temp where queryid = %ld
```

```sql
insert into bip_temp(descr) values('NEW SEARCH PLACE-HOLDER')
```

```sql
update bip_temp set price = '%s' where bpuid = %ld
```

```sql
update bip_temp set queryid = bpuid where bpuid = %ld
```

### `buyback_pricetagqueue`

```sql
delete from buyback_pricetagqueue where sessionid = %ld and buyerlocid = %ld
```

```sql
update buyback_pricetagqueue set fPrinted = 1 where fPrinted = 0 and sessionid = %ld and buyerlocid = %ld
```

```sql
update buyback_pricetagqueue set fPrinted = 1 where fPrinted = 0 and sessionid = %ld and buyerlocid = %ld and BBPTQID <= %ld
```

### `customer_location`

```sql
delete from customer_location where CustomerID = %ld and locationid = %ld
```

### `itemmaster`

```sql
update itemmaster set EdColor = c.Description     from GeneralMerchandise g     left outer join Color c on g.Color = c.ColorID     where itemmaster.uuid = g.gmuid and itemmaster.subsystem = 1         and itemmaster.EdColor = '%s'
```

### `prism_security`

```sql
DELETE FROM prism_security.dbo.MenuSecurity WHERE MenuSecurityID = %ld
```

### `selected`

```sql
Delete selected password item(s)
```

```sql
Delete selected Records?
```

### `systemlog`

```sql
delete from systemlog where slid = %ld
```

### `the`

```sql
Delete the 
```

```sql
Update the existing to match Books In Print book
```

```sql
Update the existing to match Matthews book
```

```sql
Update the existing to match tradebook
```

### `this`

```sql
Delete this Logo.
```

```sql
Delete this User List?
```

## UI message sample (first 50)

These suggest user-facing features the binary implements.

-      connect() To "%s" [%s port: %d] Failed with Error: "%s"
-      Error Connecting to Host - Stopping
-      Error Writing Record to Database - Stopping
-      Failed to Connect to Host "
-      Failed to connect to Host.
-      Failed to Create Network Socket
-      Failed to get Database Pointer - Stopping
-      Failed to get System Log Pointer - Stopping
-      gethostbyname() For "%s" Failed with Error: "%s"
-      Host Entry Not Found for "
-      Invalid Record Received with Info "
-      socket() Create SOCKET For "%s" [%s port: %d] Failed with Error: "%s"
-      System Parameters Not Set or Not Valid
-  (gethostbyname()) For "%s" Failed with Error: "%s"
-  (Not Recommended) This may create duplicate ISBNs in your system.
-  (Recommended) This allows you to review the possible duplicates.
-  2008 Microsoft Corporation. All rights reserved.
-  AND LocationID = ?
-  customer_table.AccountNumber like '%s%%'
-  customer_table.Alias like '%s%%'
-  customer_table.EMail like '%s%%'
- ' for all users?
-  is not defined for [%s].
-  is required.
-  This will abort the posting process.
- !This program cannot be run in DOS mode.
- %d digit serial numbers are not allowed without containing an alpha character.  Please click OK to reenter the serial number, or click Cancel to abort the process.
- (connect()) To "%s" [%s port: %d] Failed with Error: "%s"
- (socket()) Create SOCKET For "%s" [%s port: %d] Failed with Error: "%s"
- ? ?$?(?,?0?4?8?<?@?D?H?L?P?T?X?\?`?d?h?
- ? ?$?(?,?0?4?8?<?@?D?H?L?P?T?X?\?`?d?h?l?p?t?x?
- ? ?$?(?,?0?4?8?<?@?D?H?L?P?T?X?\?`?d?h?l?p?t?x?|?
- ? ?$?(?,?0?4?8?<?@?D?H?L?P?T?X?\?p?t?
- ? ?$?(?,?0?4?8?<?@?H?`?p?
- ? ?$?(?,?0?4?8?<?D?H?L?P?T?X?\?`?d?h?l?p?x?|?
- ? ?$?(?,?0?4?8?<?D?H?L?P?T?X?\?`?h?l?p?t?x?|?
- ? ?$?(?,?0?4?8?l?
- ? ?$?(?,?0?4?8?L?P?h?x?|?
- ? ?$?(?,?0?8?P?`?p?t?
- ? ?$?,?0?4?8?<?@?D?L?d?h?
- ? ?$?<?@?D?H?\?l?p?t?
- ? ?$?<?@?X?h?x?
- ? ?$?<?L?\?l?p?
- ? ?$?8?<?@?X?h?l?p?t?
- ? ?$?L?P?T?X?\?`?d?h?l?p?t?x?|?
- ? ?%?F?W?n?u?
- ? ?&?2?U?[?r?x?
- ? ?(?@?H?P?X?l?
- ? ?(?0?@?\?d?l?x?
- ? ?(?0?<?D?x?

