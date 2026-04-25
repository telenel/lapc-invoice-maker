# `WPAdmin.exe` — static-analysis inventory

- Total extracted strings: **5878**
- Parsed SQL statements: **205**
- Operation breakdown: INSERT=11, UPDATE=25, DELETE=26, SELECT=137, EXEC=6, MERGE=0
- Distinct tables: **79**
- Distinct procs: **11**
- Distinct views: **4**

## Write surface (tables this binary mutates)

| Table | Ops |
|---|---|
| `Acct_COA` | SELECT, UPDATE |
| `all` | DELETE, SELECT |
| `Buyers_Guide_Adopted` | DELETE, SELECT |
| `Buyers_Guide_Extended` | INSERT, SELECT |
| `Buyers_Guide_Report` | DELETE, SELECT |
| `Buyers_Guide_Vendor_Commission` | SELECT, UPDATE |
| `CatalogGroupOrder` | SELECT, UPDATE |
| `CatalogGroups` | DELETE, SELECT |
| `Current` | DELETE, SELECT |
| `custom_reports` | SELECT, UPDATE |
| `custom_Reports` | SELECT, UPDATE |
| `custom_reports_log` | INSERT, SELECT |
| `DCC_Category` | INSERT, SELECT, UPDATE |
| `DCC_Class` | DELETE, INSERT, SELECT, UPDATE |
| `DCC_Department` | DELETE, INSERT, SELECT, UPDATE |
| `DCCGLCode` | INSERT, SELECT |
| `DeptClassCat` | DELETE, INSERT, SELECT, UPDATE |
| `GraphicComponentTypes` | SELECT, UPDATE |
| `Group` | DELETE, SELECT |
| `Location_Groups` | SELECT, UPDATE |
| `mo_discount_codes` | DELETE, SELECT |
| `MO_Shipping_Codes_Location` | DELETE, SELECT |
| `MO_Shipping_Details` | DELETE, SELECT |
| `ModuleLocking` | DELETE, SELECT |
| `MonsoonMarketplaces` | DELETE, SELECT |
| `OldPassword` | INSERT, SELECT |
| `prism` | DELETE, INSERT, SELECT |
| `prism_security` | DELETE, SELECT, UPDATE |
| `Prism_Security` | DELETE, SELECT |
| `ReportParams` | INSERT, SELECT |
| `ReportSortOptions` | INSERT, SELECT |
| `royalty` | SELECT, UPDATE |
| `selected` | DELETE, SELECT |
| `Stock_Ledger` | SELECT, UPDATE |
| `SystemParameters` | SELECT, UPDATE |
| `TagType` | SELECT, UPDATE |
| `user` | DELETE, SELECT |

## Read surface (tables/views referenced via SELECT/JOIN only)

<details><summary>42 tables</summary>

- `Acct_Cash_Flow_Categories`
- `Acct_COA_Master`
- `Acct_Financial_Category_Type`
- `Buyback_Detail`
- `Buyback_Purchaser`
- `Buyback_session`
- `Buyback_Session`
- `Buyback_Session_Purchasers`
- `CatalogGroupOrder_vw`
- `Currency_Exchange`
- `Custom_Reports`
- `DCCGLCodeType`
- `DCCLocation`
- `g3_reportparam_control_types`
- `g3_reportparam_param_types`
- `Item_Tax_Type`
- `location`
- `Location`
- `Location_Group_Types`
- `Location_Grouping`
- `mo_discount_codes_method`
- `mo_discount_codes_type`
- `MO_Shipping_Codes`
- `mo_shipping_codes_location`
- `MO_Shipping_Interface`
- `MO_Shipping_Methods`
- `PaperType`
- `pos_setup`
- `Pos_Setup`
- `POS_Update_Download_Type`
- `Pubnet_Values`
- `ReportCustom`
- `ReportMaster`
- `Sequence_Type`
- `Subsystem_Table`
- `systemparameters`
- `SystemParameters_Groups`
- `TaxType`
- `the`
- `VendorAddressGroups`
- `web_routing`
- `Web_Routing`

</details>

## Stored procs called

- `CatalogGroup`
- `CatalogGroupID`
- `CatalogGroups`
- `CatalogID`
- `Catalogs`
- `E_LocationGroups_Add`
- `E_LocationGroups_AddLocation`
- `E_LocationGroups_Delete`
- `E_LocationGroups_RemoveLocation`
- `RoyaltyUpdateByDccLocationRoyaltySet`
- `RoyaltyUpdateByLocationSelection`

## Views referenced

- `VW_DCCGLCODE_DISTLOC`
- `VW_DCC_LOOKUP`
- `VW_GL_ACCT_NAV`
- `VW_GROUP_MODULE_DESC`

## Write statements (verbatim)

### `Acct_COA`

```sql
Update Acct_COA set COAMasterID = %d where COAID = %d
```

### `Buyers_Guide_Adopted`

```sql
delete Buyers_Guide_Adopted where sku = %d and BGVendorID = %d
```

### `Buyers_Guide_Extended`

```sql
Insert Into Buyers_Guide_Extended (Bookkey, LocationID, BGVendorID) Values ('%s', %d, %d)
```

### `Buyers_Guide_Report`

```sql
DELETE Buyers_Guide_Report WHERE BGVendorID = %d
```

### `Buyers_Guide_Vendor_Commission`

```sql
UPDATE Buyers_Guide_Vendor_Commission SET abpercent = %f, newpercent = %f, usedpercent = %f WHERE BGVendorID = %ld
```

### `CatalogGroupOrder`

```sql
update CatalogGroupOrder set CatalogGroupParentID %s, DisplayIdx = -1 where %s = %d
```

### `CatalogGroups`

```sql
delete CatalogGroups where CatalogGroupID = 
```

```sql
delete from CatalogGroups where CatalogGroupID = %d
```

### `Current`

```sql
Delete Current Control Record?
```

### `DCCGLCode`

```sql
Insert into DCCGLCode (GLCodeTypeID, DCCID, DCCMask, LocationID, COAID) values (1, %d, %d, %d, 0)
```

### `DCC_Category`

```sql
INSERT INTO DCC_Category ( CatName, Department, Class, Category) VALUES ( '%s', %ld, %ld, %ld )
```

```sql
Update DCC_Category SET CatName = '%s' WHERE Department = %d AND Class = %d AND Category = %d
```

### `DCC_Class`

```sql
DELETE FROM DCC_Class WHERE Department = %s AND Class = %s
```

```sql
INSERT INTO DCC_Class ( ClassName, Class, Department) VALUES ( '%s', %ld, %ld )
```

```sql
Update DCC_Class SET ClassName = '%s' WHERE Department = %d AND Class = %d
```

### `DCC_Department`

```sql
DELETE FROM DCC_Department WHERE Department = %s
```

```sql
INSERT INTO DCC_Department ( Subsystem, DeptName, Department ) VALUES ( %d, '%s', %ld)
```

```sql
Update DCC_Department SET DeptName = '%s' WHERE Department = %d
```

```sql
Update DCC_Department SET Subsystem = %d WHERE Department = %d
```

### `DeptClassCat`

```sql
DELETE FROM DeptClassCat WHERE DeptClassCat.DCCID = %ld
```

```sql
INSERT INTO DeptClassCat ( DCCID, Department, Class, Category, DCCType) VALUES ( %ld, %ld, %ld, %ld, 3 )
```

```sql
UPDATE DeptClassCat SET DCCType = %ld WHERE DCCID = %ld
```

### `GraphicComponentTypes`

```sql
UPDATE GraphicComponentTypes SET SortOrder = %d WHERE GraphicComponentTypeID = %d
```

### `Group`

```sql
Delete Group
```

### `Location_Groups`

```sql
UPDATE Location_Groups SET GroupDescription = '%s' WHERE LocationGroupID = %d
```

```sql
UPDATE Location_Groups SET GroupName = '%s' WHERE LocationGroupID = %d
```

### `MO_Shipping_Codes_Location`

```sql
delete from MO_Shipping_Codes_Location where ShipCodeID = %ld and LocationID = %ld
```

### `MO_Shipping_Details`

```sql
DELETE FROM MO_Shipping_Details WHERE ShipCodeDID = %ld
```

### `ModuleLocking`

```sql
DELETE ModuleLocking WHERE ModuleID = %d AND RecordID = %d
```

### `MonsoonMarketplaces`

```sql
DELETE FROM MonsoonMarketplaces WHERE MarketPlaceID = %ld
```

### `OldPassword`

```sql
insert into OldPassword (OPassTypeId, Password, RecordId) values(1, '%s', %d)
```

### `Prism_Security`

```sql
delete Prism_Security.dbo.GroupSecurity where GroupSecID = %d
```

```sql
delete Prism_Security.dbo.GroupSecurityOptions where GroupSecID = %d
```

### `ReportParams`

```sql
INSERT INTO ReportParams (REPUID,ParamName,ControlLabel,ParamType,ControlType,TabOrder,ExtraData) VALUES (%ld, '%s', '%s', %d, %d, %d, '%s')
```

### `ReportSortOptions`

```sql
INSERT INTO ReportSortOptions (RSOUID, REPUID, SortDesc, SortOrder, AccessSortOrder, TabOrder) VALUES (%ld, %ld, '%s', '%s', '%s', %d)
```

### `Stock_Ledger`

```sql
UPDATE Stock_Ledger SET EndingInvCost = %.2f, EndingInvRetail = %.2f WHERE LocationID = %d AND DCCID = %d AND AcctDate = '%s'
```

### `SystemParameters`

```sql
update SystemParameters set ParamValue = %d where LocationId = 0 and ParamName like 'AllokenTerm'
```

```sql
update SystemParameters set ParamValue = '%s' where LocationId = 0 and ParamName like 'AllokenEmail'
```

```sql
update SystemParameters set ParamValue = '%s' where LocationId = 0 and ParamName like 'AllokenStore'
```

```sql
update SystemParameters set ParamValue = '%s' where ParamType = 127
```

```sql
update SystemParameters set ParamValue = '%s' where ParamType = 2563
```

```sql
UPDATE SystemParameters SET ParamValue = '0' WHERE ParamType = %d AND LocationID <> %d AND LocationID <> -1
```

### `TagType`

```sql
update TagType set Description = '%s', IsDefault = %d where TagTypeId = %d
```

### `all`

```sql
Delete all accounts?
```

### `custom_Reports`

```sql
UPDATE custom_Reports.dbo.ReportMaster SET PDFFileName = '%s' WHERE REPUID = %ld 
```

### `custom_reports`

```sql
update custom_reports.dbo.Report_CustomReport set CustomReportID = %d, SPName = '%s' where REPUID = %d 
```

### `custom_reports_log`

```sql
INSERT INTO custom_reports_log.dbo.Reports_Downloaded (StoreID, CustomReportID, DateDownloaded) VALUES (%s, %d, GetDate())
```

### `mo_discount_codes`

```sql
delete from mo_discount_codes where modiscid = %ld and locationid = %ld
```

### `prism`

```sql
delete from prism.dbo.POS_Register_Access where UserID = %ld
```

```sql
insert into prism.dbo.systemlog (datelogged, apptext) values (getdate(), 'BGLoad - Could not set timeouts')
```

### `prism_security`

```sql
delete from prism_security.dbo.prismuser where suid = %ld
```

```sql
update prism_security.dbo.PrismUser set SuperUser = '%s' where SUID = %d
```

### `royalty`

```sql
Update royalty percentage and minimum for DCCs, items, and proposed purchase orders at the selected location(s)?
```

```sql
Update royalty percentage and minimum for inventory and proposed purchase orders at the selected location(s) and DCC(s)?
```

### `selected`

```sql
Delete selected accounts?
```

```sql
Delete selected catalog group?
```

### `user`

```sql
Delete user and all of their accounts?
```

## UI message sample (first 50)

These suggest user-facing features the binary implements.

-  AND ParamType not in (306,307) 
-  Display full pages
-  with superuser priveledges.
- !Restore the window to normal size
- !This program cannot be run in DOS mode.
- %d of %d terms were created and sent.
- &About WPAdmin...
- ? ?$?(?,?0?4?8?<?@?D?H?L?P?T?\?t?
- ? ?$?(?,?0?4?8?<?@?D?H?L?P?T?X?\?`?d?h?l?p?t?
- ? ?$?(?,?0?4?8?<?@?D?H?L?P?T?X?\?`?d?h?l?p?t?x?|?
- ? ?$?(?,?0?4?8?<?@?D?H?L?P?T?X?\?`?d?t?
- ? ?$?(?0?H?X?h?l?p?t?x?
- ? ?(?@?P?`?h?p?
- ? ?)?.?4?>?H?R?\?f?j?p?z?
- ? ?8?<?T?X?p?t?
- ? ?D?L?T?\?d?l?t?|?
- ?Display program information, version number and copyright
- [REPUID] = %ld and [BlobPDF] is not null
- > >$>(>,>0>4>8><>@>D>H>L>P>T>X>\>`>d>h>l>x>|> ?$?(?,?0?4?8?<?@?D?H?L?P?T?X?\?`?d?h?l?p?t?x?|?
- 6Open another window for the active document
- A custom report entitled '%s' already exists.
- A custom report entitled '%s' has been successfully downloaded.
- A set of default flags does not exist.  Use the 'Default Values' hammer option to create one.
- About4Quit the application; prompts to save documents
- Account Description is required.
- Account is required.
- Account must be unique.
- Activate this window
- All locations have already been assigned to groups.
- An existing user must be chosen when "Copy Existing Users Settings" is checked
- Are you sure this is what you want to do?
- Are you sure you want to clear all?
- Are you sure you want to do this?
- Are you sure you want to reset the passphrase.  All encrypted data will be lost.
- Are you sure you want to set all?
- Arrange Icons/Arrange windows so they overlap
- At least one mode needs to be selected with a type.
- Attempting to initialize the location group tree control to an invalid type.
- BaseCurrencyID = ?
- Buffer error writing to file: '%s.'
- Cannot uncheck this.  Scroll to the record you want as the currency base and check it.
- Cascade Windows5Arrange windows as non-overlapping tiles
- Cashier added by 360
- Change completed.
- Change the window position
- Change the window size
- Changes completed.
- Changing the First Month will change the period date ranges.
- Client connecting to database 'custom_reports_log' on server: %s on port: %s
- Client connecting to server: %s on port: %s

