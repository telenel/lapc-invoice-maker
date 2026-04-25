# `ItemMnt.dll` — static-analysis inventory

- Total extracted strings: **6107**
- Parsed SQL statements: **207**
- Operation breakdown: INSERT=10, UPDATE=18, DELETE=34, SELECT=137, EXEC=8, MERGE=0
- Distinct tables: **79**
- Distinct procs: **9**
- Distinct views: **15**

## Write surface (tables this binary mutates)

| Table | Ops |
|---|---|
| `BIP_Temp` | DELETE, SELECT |
| `current` | DELETE, SELECT |
| `Current` | DELETE, SELECT |
| `DigitalTxtHeader` | DELETE, SELECT |
| `GeneralMerchandise` | DELETE, SELECT |
| `Inv_POVendor` | DELETE, INSERT, SELECT |
| `inventory` | SELECT, UPDATE |
| `Inventory` | DELETE, SELECT |
| `Inventory_NonMerch` | DELETE, INSERT, SELECT |
| `item` | SELECT, UPDATE |
| `Item` | SELECT, UPDATE |
| `Item_Components_Detail` | SELECT, UPDATE |
| `Item_Xref` | DELETE, INSERT, SELECT, UPDATE |
| `Item_XREF` | DELETE, SELECT |
| `Matrix_Attrib_Order` | DELETE, INSERT, SELECT |
| `OnHold` | DELETE, INSERT, SELECT |
| `OnHoldType` | INSERT, SELECT |
| `packagedetail` | DELETE, SELECT |
| `PackageHeader` | DELETE, SELECT |
| `Price_Change_DCCID` | DELETE, SELECT |
| `Price_Change_Detail` | DELETE, SELECT |
| `price_change_table` | DELETE, SELECT |
| `Price_Change_Table` | INSERT, SELECT, UPDATE |
| `SerialNumberDetail` | DELETE, SELECT, UPDATE |
| `ShelfLocations` | SELECT, UPDATE |
| `Style_Location_Colors` | SELECT, UPDATE |
| `Style_Locations` | SELECT, UPDATE |
| `Textbook` | DELETE, SELECT |
| `Tradebook` | DELETE, SELECT |
| `VERBA_Import` | DELETE, INSERT, SELECT |
| `verba_price_change` | DELETE, SELECT |
| `VERBA_Price_Change` | DELETE, SELECT |
| `Verba_Price_Change_View` | SELECT, UPDATE |
| `VERBA_Price_Change_View` | SELECT, UPDATE |
| `warranty` | DELETE, SELECT |

## Read surface (tables/views referenced via SELECT/JOIN only)

<details><summary>44 tables</summary>

- `Binding`
- `Binding_ONIX`
- `Bundle_DetailItem`
- `Color`
- `DigitalTxtDetail`
- `DigitalTxtInstructions`
- `EQListData`
- `GblComment`
- `GMSize`
- `ImportLog`
- `Inv_ShelfLocations`
- `InventoryStatusCodes`
- `Item_Components_Header`
- `Item_Tax_Type`
- `ItemSeasonCodes`
- `location`
- `Location`
- `Matrix_Attrib`
- `PackageDetail`
- `packageheader`
- `PackageType`
- `POS_Fee_Codes`
- `Price_Change_Location`
- `prism`
- `prism_security`
- `Rental_Header_Item`
- `SerialNumberHeader`
- `Stock_Adjustment_Table`
- `StockAdjustReason_vw`
- `Style_Graphics`
- `Style_Template`
- `Styles`
- `SystemParameters`
- `TagType`
- `TagTypePrinter`
- `TaxType`
- `textbook`
- `TextStatus`
- `TextStatus_ONIX`
- `TradeStatus`
- `TradeStatus_ONIX`
- `VendorMaster`
- `VERBA_Price_Change_History`
- `Warranty`

</details>

## Stored procs called

- `E_CreateItemsFromStyle`
- `E_StyleDetail_Set`
- `E_StyleTemplateDetail_Add_`
- `E_StyleTemplateDetail_Delete_`
- `E_StyleTemplateDetail_Set`
- `E_StyleTemplate_UpdateItems`
- `E_Style_Cascade_Cost_Retail`
- `RoyaltyCost`
- `StyleInventoryStatusUpdate`

## Views referenced

- `VW_DCC_LOOKUP`
- `VW_DigitalTxtHeader`
- `VW_Forecast_Curve`
- `VW_INVENTORY_ROYALTY_DEFAULTS`
- `VW_ITM_BARCODE`
- `VW_ITM_MASTER`
- `VW_Inventory_NonMerch`
- `VW_Inventory_Vendor`
- `VW_SEASON_CODE_SKUS`
- `VW_STYLE_SKUS`
- `VW_STYLE_TEMPLATE_COLORS`
- `VW_STYLE_TEMPLATE_SIZES`
- `vw_Term`
- `vw_itm_master`
- `vw_term`

## Write statements (verbatim)

### `BIP_Temp`

```sql
delete from BIP_Temp where QueryID = %ld
```

### `Current`

```sql
Delete Current Digital Instruction?
```

```sql
Delete Current Digital Textbook?
```

```sql
Delete Current On Hold Type?
```

```sql
Delete Current Quantity?
```

### `DigitalTxtHeader`

```sql
delete from DigitalTxtHeader where DigitalTxtID = %d
```

### `GeneralMerchandise`

```sql
DELETE GeneralMerchandise WHERE GMUID = %d
```

```sql
DELETE GeneralMerchandise WHERE SKU = %ld
```

### `Inv_POVendor`

```sql
DELETE Inv_POVendor WHERE SKU = %d
```

```sql
DELETE Inv_POVendor WHERE SKU = %d AND LocationID = %d
```

```sql
INSERT INTO Inv_POVendor (VendorID, LocationID, SKU, MinimumStock, MaximumStock, AutoOrderQty, MinOrderQty, VendorCatNumber, Rank) SELECT VendorID, LocationID, %d, MinimumStock, MaximumStock, AutoOrderQty, MinOrderQty, VendorCatNumber, Rank FROM Inv_POVendor WHERE SKU = %d
```

```sql
INSERT INTO Inv_POVendor (VendorID, SKU, LocationID, MinimumStock, MaximumStock, AutoOrderQty, MinOrderQty, VendorCatNumber, Rank, Cost) VALUES (%d, %d, %d, %d, %d, %d, %d, '%s', %d, %f)
```

### `Inventory`

```sql
DELETE Inventory WHERE SKU = %d AND LocationID = %d
```

### `Inventory_NonMerch`

```sql
delete from Inventory_NonMerch where InvNonMerchId = %d
```

```sql
insert into Inventory_NonMerch (SKU, LocationId, FeeCodeId) values (%d, %d, %d)
```

### `Item`

```sql
update Item set BarCode = null where SKU = %d
```

```sql
UPDATE Item SET fDiscontinue = 1 WHERE SKU = %d AND Subsystem = %d
```

```sql
UPDATE Item SET fDiscontinue = 1 WHERE SKU = %ld AND Subsystem = %d
```

### `Item_Components_Detail`

```sql
update Item_Components_Detail set fRental = %d where SKU = %ld
```

### `Item_XREF`

```sql
delete from Item_XREF where SKU = %d %s
```

### `Item_Xref`

```sql
DELETE FROM Item_Xref WHERE SKU = %ld
```

```sql
delete Item_Xref where ItemXrefID = %d
```

```sql
INSERT INTO Item_Xref (SKU, Barcode, SortOrder) VALUES (%d, '%s', %d)
```

```sql
insert into Item_Xref (SKU, Barcode, SortOrder) values(%d, '%s', %d)
```

```sql
update Item_Xref set SortOrder = %d where ItemXrefID = %d
```

### `Matrix_Attrib_Order`

```sql
DELETE Matrix_Attrib_Order WHERE MatrixID = %d
```

```sql
INSERT INTO Matrix_Attrib_Order VALUES (%d, %d, '%s', %d)
```

### `OnHold`

```sql
delete from OnHold where OnHoldId = %d and OnHoldTypeId = %d
```

```sql
insert into OnHold (SKU, LocationID, OnHoldTypeId) values(%d, %d, %d)
```

### `OnHoldType`

```sql
insert into OnHoldType (Name) values('%s')
```

### `PackageHeader`

```sql
delete from PackageHeader where PackageID = %d
```

```sql
DELETE PackageHeader WHERE PackageID = %d
```

### `Price_Change_DCCID`

```sql
DELETE Price_Change_DCCID WHERE PriceChangeID = %ld
```

### `Price_Change_Detail`

```sql
DELETE FROM Price_Change_Detail WHERE PriceChangeID = %ld AND SKU = %ld AND LocationID = %ld
```

### `Price_Change_Table`

```sql
insert into Price_Change_Table (RoundingMtd,RndAmt,fNewUsed,fUsedNew,Description,Type,ProcessUser) values(0,0,%d,%d,'VERBA ' + cast((getdate()) as varchar),2,'%s')
```

```sql
update Price_Change_Table set RoundingMtd = 0, RndAmt = 0, fNewUsed = %d, fUsedNew = %d where PriceChangeID = %d
```

### `SerialNumberDetail`

```sql
DELETE FROM SerialNumberDetail WHERE SerialDID = %ld
```

```sql
update SerialNumberDetail set Price = %.2f where SerialID = %ld 
```

### `ShelfLocations`

```sql
UPDATE ShelfLocations SET fDisable = 0, ShelfDesc = '%s' WHERE ShelfDesc = '%s'
```

```sql
UPDATE ShelfLocations SET fDisable = 1 WHERE ShelfLocationID = %d
```

### `Style_Location_Colors`

```sql
UPDATE Style_Location_Colors SET IsLocked = 0 WHERE StyleLocationID = %d
```

### `Style_Locations`

```sql
UPDATE Style_Locations SET IsLocked = 0 WHERE StyleLocationID = %d
```

### `Textbook`

```sql
DELETE Textbook WHERE SKU = %ld
```

```sql
DELETE Textbook WHERE TXUID = %d
```

### `Tradebook`

```sql
DELETE Tradebook WHERE SKU = %ld
```

```sql
DELETE Tradebook WHERE TRUID = %d
```

### `VERBA_Import`

```sql
delete VERBA_Import
```

```sql
Insert into VERBA_Import (SKU,NewPrice) Values (%s, $%s)
```

### `VERBA_Price_Change`

```sql
DELETE FROM VERBA_Price_Change WHERE VERBAID = %ld
```

### `VERBA_Price_Change_View`

```sql
update VERBA_Price_Change_View set fProcess = %d, VERBAUser = '%s' where LocationID in (%s)
```

```sql
update VERBA_Price_Change_View set fProcess = 0 where LocationID in (%s) and fProcess = 1
```

### `Verba_Price_Change_View`

```sql
update Verba_Price_Change_View set fProcess = %d where VERBAId = %d
```

```sql
update Verba_Price_Change_View set fProcess = %d, VERBAUser = '%s' where VERBAId = %d
```

### `current`

```sql
Delete current 
```

```sql
Delete current style?
```

### `inventory`

```sql
update inventory set 
```

### `item`

```sql
update item set BarCode = '%s' where SKU = %d
```

### `packagedetail`

```sql
delete from packagedetail where packagedid = %ld
```

### `price_change_table`

```sql
delete from price_change_table where pricechangeid = %ld
```

### `verba_price_change`

```sql
delete verba_price_change where fProcess = 0 and VERBAId in (select VERBAId from VERBA_Price_Change_View where LocationID = %d)
```

### `warranty`

```sql
delete from warranty where warrantyid = %ld
```

## UI message sample (first 50)

These suggest user-facing features the binary implements.

-   and v.PostWeek > dateadd(week, -104, getdate())   and v.PostWeek < getdate() order by l.StoreNumber, v.SKU, v.PostWeek 
-   Do you wish to continue?
-   Hence it Cannot be Deleted
-   No Stores are selected.
-  and BarCode not in (%s)
-  for all of this style's items, at the selected location(s)?
-  has invalid StoreNumber or sku.
-  No Changes have been made to inventory
-  Please choose only one Location. 
-  Prices not updated. 
- !This program cannot be run in DOS mode.
- %d Items added, %d updated,
- .  The error is: 
- ? ?$?(?,?0?4?8?<?@?D?H?L?P?T?X?\?`?d?h?
- ? ?$?(?,?0?4?8?<?@?D?H?L?P?T?X?\?`?d?h?l?p?t?x?|?
- ? ?$?(?D?\?t?
- ? ?$?,?0?8?<?@?H?`?d?|?
- ? ?&?,?2?8?>?D?J?P?V?\?b?h?n?t?z?
- ? ?(?4?T?\?d?l?x?
- ? ?@?\?d?l?x?
- ? ?@?H?T?\?t?|?
- ? ?1?B?S?\?e?~?
- ? ?8?N?a?h?{?
- > >$>(>,>0>4>8><>@>D>H>L>P>T>X>\>`>d>p>t>X?\?`?d?h?l?p?t?x?|?
- A barcode is required.
- A manufacturer is required for non-rental agreements.
- A master style template is required.
- A master style template name is required.
- A package with description: '%s' already exists. Please choose a different description.
- A style graphic is required.
- A style name is required.
- A warranty name is required.
- All Textbook and Tradebook ISBNs will be converted to 13 Digits.  Do you Wish to Continue?
- An invalid DCC was found for SKU 
- Are you sure you want to process the selected VERBA Price Changes?
- Are you sure you want to set '%s' to default?
- At least one item was not added to this Price Change because its SKU may not meet the specific User List criteria and/or it may not exist at one or more of the selected Locations.
- Attempted to add an invalid SKU to inventory.
- Author cannot be blank.
- Bar Code [%s] already exists - Do you want to add it anyway?
- Bundles must contain at least two components.
- Changes have been made to the grid that have not been applied to the items through the options menu. Continue without applying the changes?
- Components of this bundle do not all have inventory at location %s
- Could not open CSV File
- Create Date...
- Data may be lost...
- Description cannot be blank.
- Digital Instruction: '%s' is the current Digital Instruction default.
- Digital Textbook already Exists.
- DigitalTxtID = ?

