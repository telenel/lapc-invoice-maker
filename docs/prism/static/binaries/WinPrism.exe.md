# `WinPrism.exe` — static-analysis inventory

- Total extracted strings: **18754**
- Parsed SQL statements: **856**
- Operation breakdown: INSERT=40, UPDATE=83, DELETE=80, SELECT=640, EXEC=11, MERGE=2
- Distinct tables: **274**
- Distinct procs: **20**
- Distinct views: **63**

## Write surface (tables this binary mutates)

| Table | Ops |
|---|---|
| `AutogenMR_Location` | DELETE, SELECT |
| `AutogenPO_DCCID` | DELETE, SELECT |
| `AutogenPO_Location` | DELETE, SELECT |
| `AutogenRet_DCCID` | DELETE, SELECT |
| `AutogenRet_Location` | DELETE, SELECT |
| `AutogenRet_Term` | DELETE, SELECT |
| `AutogenRet_Vendor` | DELETE, SELECT |
| `bip_temp` | INSERT, SELECT, UPDATE |
| `BIP_Temp` | DELETE, SELECT |
| `Bundle_DetailItem` | DELETE, SELECT |
| `Catalog_Sales_Detail` | DELETE, SELECT, UPDATE |
| `Catalog_Sales_Header` | SELECT, UPDATE |
| `Catalog_Sales_Tender` | DELETE, SELECT |
| `CatalogGroupOrder` | SELECT, UPDATE |
| `CatalogItems` | DELETE, SELECT, UPDATE |
| `Catalogs` | DELETE, SELECT |
| `CMD_CatalogProductFamilies_Delete` | DELETE, SELECT |
| `cr_course` | DELETE, SELECT |
| `CR_Detail` | SELECT, UPDATE |
| `CR_Enrollment` | DELETE, SELECT |
| `CR_Enrollment_Detail` | DELETE, SELECT |
| `CR_Locations_Detail` | DELETE, INSERT, SELECT |
| `CR_Shelftags` | SELECT, UPDATE |
| `CRT_Detail` | SELECT, UPDATE |
| `current` | DELETE, SELECT |
| `Current` | DELETE, SELECT |
| `Customer_Address` | SELECT, UPDATE |
| `Customer_Table` | SELECT, UPDATE |
| `Fiscal_Inventory_Header_Table` | SELECT, UPDATE |
| `IncomingMessages` | DELETE, SELECT, UPDATE |
| `Instructors_Detail` | DELETE, INSERT, SELECT, UPDATE |
| `Item` | DELETE, SELECT |
| `MailOrderPinpad` | DELETE, SELECT, UPDATE |
| `MarkdownDelete_cmd` | DELETE, SELECT |
| `MarkdownItemDelete_cmd` | DELETE, SELECT |
| `MarkdownSchedule` | SELECT, UPDATE |
| `MarkdownScheduleConfig` | DELETE, SELECT, UPDATE |
| `MarkdownScheduleDelete_cmd` | DELETE, SELECT |
| `MOFulfillmentHeader` | DELETE, SELECT |
| `MR_Location` | SELECT, UPDATE |
| `MT_Header` | DELETE, SELECT |
| `mt_location` | DELETE, SELECT |
| `NBCPPeriodRetain` | DELETE, INSERT, SELECT, UPDATE |
| `NMRPSessionRetain` | DELETE, INSERT, SELECT, UPDATE |
| `NMRPTransactionDetail` | SELECT, UPDATE |
| `Order` | SELECT, UPDATE |
| `order_decisions` | SELECT, UPDATE |
| `Order_Decisions` | SELECT, UPDATE |
| `OTB_DCCID` | DELETE, SELECT |
| `OTB_Detail` | SELECT, UPDATE |
| `OTB_Revision` | SELECT, UPDATE |
| `OutgoingMessages` | DELETE, SELECT, UPDATE |
| `PDA_WL_Request` | DELETE, SELECT |
| `PO_BuyerLimit` | DELETE, INSERT, SELECT |
| `PO_Header` | SELECT, UPDATE |
| `PO_Location` | SELECT, UPDATE |
| `PO_Vendor` | SELECT, UPDATE |
| `problem_notifications_detail` | INSERT, SELECT, UPDATE |
| `Problem_Notifications_Detail` | DELETE, SELECT |
| `problem_notifications_header` | DELETE, INSERT, SELECT |
| `Problem_Notifications_Header` | DELETE, SELECT |
| `Rcv_Staging_Detail` | DELETE, INSERT, SELECT |
| `Rcv_Staging_Header` | INSERT, SELECT |
| `Rcv_Staging_Location` | DELETE, INSERT, SELECT, UPDATE |
| `Rcv_Staging_Location_Type` | DELETE, INSERT, SELECT, UPDATE |
| `Rental` | DELETE, SELECT |
| `Rental_Adoption_Detail` | DELETE, SELECT, UPDATE |
| `Rental_Adoption_Header` | DELETE, SELECT |
| `Rental_Detail` | DELETE, SELECT, UPDATE |
| `Rental_Email` | SELECT, UPDATE |
| `Rental_Header_Item_Period` | DELETE, SELECT |
| `Rental_History` | SELECT, UPDATE |
| `Rental_MO_Xref` | DELETE, SELECT |
| `Rental_Setup_Pos` | SELECT, UPDATE |
| `Rental_Term` | DELETE, INSERT, SELECT |
| `RentalAccount` | DELETE, INSERT, SELECT |
| `RentalAuthoFailureLog` | INSERT, SELECT |
| `RNRRegAssignment` | DELETE, SELECT |
| `SalesHistoryHeader` | DELETE, SELECT |
| `salestable` | SELECT, UPDATE |
| `SalesTable` | DELETE, SELECT |
| `Scheduled` | DELETE, SELECT |
| `ScheduledReport` | DELETE, INSERT, SELECT, UPDATE |
| `selected` | DELETE, SELECT |
| `SystemParameters` | SELECT, UPDATE |
| `Template` | DELETE, SELECT |
| `tempsalestable` | DELETE, SELECT |
| `the` | DELETE, SELECT |
| `this` | DELETE, SELECT |
| `Transaction_Address` | SELECT, UPDATE |
| `Transaction_Detail` | DELETE, SELECT, UPDATE |
| `Transaction_Header` | SELECT, UPDATE |
| `Transaction_Tender` | DELETE, SELECT, UPDATE |
| `WantList_Location` | DELETE, SELECT |
| `WantListDetail` | DELETE, SELECT |
| `wantlistheader` | DELETE, SELECT |
| `WebOrderDepositProcessLogDetail` | SELECT, UPDATE |
| `whl_detail` | DELETE, SELECT |
| `wlvt` | SELECT, UPDATE |
| `XDoc_Exceptions` | INSERT, SELECT |
| `XDoc_Header` | SELECT, UPDATE |
| `XDoc_Log` | INSERT, SELECT |
| `XDoc_Note` | DELETE, INSERT, SELECT |
| `XDoc_Target` | SELECT, UPDATE |

## Read surface (tables/views referenced via SELECT/JOIN only)

<details><summary>170 tables</summary>

- `Acct_Agency`
- `Acct_agency_Customer`
- `Acct_Agency_Customer`
- `Acct_COA`
- `AutogenPO`
- `AutogenRet`
- `BackOrder_Reason`
- `BundleTran_vw`
- `Buyback_Receipt_Printers`
- `buyers_guide_table`
- `Buyers_Guide_Table`
- `Buyers_Guide_Vendor_Commission`
- `Buyers_Guide_Vendors`
- `CatalogAux`
- `CatalogGroups`
- `CatalogProductFamilies`
- `CatalogProductFamilyAux`
- `CatalogTypes`
- `CD_Detail`
- `CD_Header`
- `CR_Campus`
- `CR_Course`
- `CR_Department`
- `CR_DEPARTMENT`
- `cr_detail`
- `CR_Detail_Options`
- `cr_header`
- `CR_Header`
- `cr_locations`
- `CR_Locations`
- `cr_term`
- `CR_Term`
- `CR_ZeroSkuDetail`
- `CRCourseLevel`
- `CRT_Header`
- `Customer_Location`
- `dbo`
- `DigitalTxtHeader`
- `E_VW_PO_EMAILS`
- `GeneralMerchandise`
- `Instructors`
- `inventory`
- `Inventory`
- `Inventory_NonMerch`
- `Invoice_Location`
- `invwks_dcc`
- `item`
- `Item_Tax_Type`
- `ItemMaster`
- `location`
- `Location`
- `LocationSelectionLocations`
- `MarkdownAux`
- `MarkdownItemLocation`
- `MarkdownScheduleConfigDetail`
- `Mathews_Books`
- `Matrix_Header`
- `MO_Discount_Codes`
- `MO_Email`
- `MO_Shipping_Codes`
- `MO_Shipping_FillType`
- `Monarch_Printers`
- `mr_detail`
- `MR_Detail`
- `mr_header`
- `MR_Header`
- `mr_location`
- `MR_ShipTypes`
- `MsgReportType`
- `MsgSubType`
- `mt_costtypes`
- `MT_Detail`
- `NBCPGetReconcileSessions_vw`
- `NMRPCustomerDialog_vw`
- `OTB_Header`
- `OTB_Location`
- `packagedetail`
- `packageheader`
- `PackageType`
- `po_detail`
- `PO_Detail`
- `po_header`
- `po_location`
- `PO_LOCATION`
- `pos_fee_codes`
- `POS_Fee_Codes`
- `POS_MSR_Card_Types`
- `Pos_Setup`
- `prism`
- `prism_security`
- `Prism_Security`
- `Purch_AddConfig`
- `QuickSearchType`
- `Reason_Code`
- `Recurrence`
- `rental_detail`
- `Rental_Header_Item`
- `Rental_Period`
- `Rental_Setup_Main`
- `Rental_Setup_POS`
- `Rental_TagType`
- `RentalPeriodSession_vw`
- `RentalSession`
- `RentalSessionAccount`
- `Report_SaveParams_Detail`
- `Report_SaveParams_Header`
- `ReportCustom`
- `ReportGenHeader`
- `ReportMaster`
- `ReportParams`
- `reportsortoptions`
- `ReportSortOptions`
- `ResolveTextbookSku_vw`
- `ResolveTradebookSku_vw`
- `ReturnPolicy`
- `SalesHistoryType`
- `ScheduledReportStatus`
- `serialnumberheader`
- `SerialNumberHeader`
- `ShipVia`
- `status_codes`
- `Status_Codes`
- `Stock_Ledger_Reverse`
- `Store_Information_Table`
- `subsystem_table`
- `Subsystem_Table`
- `sys`
- `systemparameters`
- `Systemparameters`
- `TagTypePrinter`
- `Tax_Code_Group`
- `Tax_Code_Grouping`
- `Tax_Codes`
- `Tax_Codes_Location`
- `Tender_Auth_Types`
- `Tender_Codes`
- `Tender_Codes_Location`
- `Textbook`
- `transaction_detail`
- `VendorAddress`
- `vendormaster`
- `VendorMaster`
- `VendorOrderingMethod`
- `VendorParameters`
- `WantlistHeader`
- `WantListHeader`
- `WantListLocationTerm`
- `WantListLocationTerm_vw`
- `WantlistVendor`
- `WantListVendor`
- `WantlistVendorTerm`
- `WantListVendorTerm`
- `Warranty`
- `WHL_Detail`
- `x12_ASN_carton`
- `X12_ASN_Carton`
- `x12_ASN_Item`
- `X12_ASN_Item`
- `x12_ASN_PO`
- `X12_ASN_PO`
- `XDOC_ExchangeDetail`
- `xdoc_filltype`
- `XDoc_ItemInfo`
- `xdoc_note`
- `xdoc_ordertype`
- `XDoc_Source`
- `xdoc_target`
- `xdoc_translator`
- `xdoc_type`
- `XDoc_VendorPreferences`

</details>

## Stored procs called

- `CatalogID`
- `CatalogItemID`
- `CatalogProductFamilyID`
- `CatalogRemoveItem`
- `Catalogs`
- `E_CatalogInventory_SynchLocations`
- `MarkDownApplyScheduleTemplate`
- `MarkDownCreateScheduleConfigDetail`
- `MediaUnlinkFiles`
- `NBCPClosePeriod`
- `NMRPCloseAccountSession`
- `P_Rental_Adoption_AddTestData`
- `RentalAccountID`
- `RentalPID`
- `RentalPeriodName`
- `RentalSessionID`
- `RentalTagTypeID`
- `Rental_Replace_XREF_Validate`
- `ResendCatalogsToHub`
- `SP_PO_UpdateArtInstructions`

## Views referenced

- `VW_COURSE_SELECTION`
- `VW_CR_DETAIL`
- `VW_CR_HEADER`
- `VW_CR_LOCATIONS_CAMPUS`
- `VW_CR_LOCATIONS_TERM`
- `VW_CatalogInventory`
- `VW_CatalogProductFamilyVendor`
- `VW_DCCLOCATION`
- `VW_FISC_INV_TEMP_TBL`
- `VW_INCOMINGMESSAGES_NAVIGATOR`
- `VW_ITM_BARCODE`
- `VW_ITM_MASTER`
- `VW_MO_DISCOUNT_SELECT`
- `VW_MO_DISPLAY_SHIP`
- `VW_MO_SALE_DTL`
- `VW_MO_SALE_HEADER`
- `VW_MO_SELECT_SHIP`
- `VW_MO_SHIP_HEADER`
- `VW_MR_PROP_DETAIL`
- `VW_MT_FILL_TERMS`
- `VW_ORDER_DECISIONS_LOCATIONS`
- `VW_ORDER_DECISIONS_MASTER_SKUS`
- `VW_ORDER_DECISIONS_ROW_CFG`
- `VW_ORD_Decisions_EX`
- `VW_ORD_Decisions_Grid_EX`
- `VW_OTB_Header`
- `VW_OUT_MSG_DTL`
- `VW_Ord_Decisions`
- `VW_POS_ITEM_RESULTS`
- `VW_PO_OrderIncrementWarnings`
- `VW_PO_PROP_DETAIL`
- `VW_PO_SHIP_LOCATION`
- `VW_PO_STYLES`
- `VW_PO_STYLE_LOCATION_COMPONENTS_EX`
- `VW_PRET_INVDETAIL`
- `VW_PRET_INVOICE_DTL`
- `VW_PRET_NAVIGATOR`
- `VW_PRET_SN_ONLY`
- `VW_PURCH_SHIPVIA`
- `VW_RCV_OPEN_DETAIL`
- `VW_RCV_PRIOR_RECEIVING`
- `VW_REPORT_MASTER`
- `VW_RentalAdoptionDlg_Detail`
- `VW_RentalAdoptionDlg_Header`
- `VW_Rental_Header_Ex`
- `VW_Rental_Period`
- `VW_SERIAL_NUMBER_DETAIL`
- `VW_TEMPSALES_NAVIGATOR`
- `VW_TENDER_CODE_LOC`
- `VW_WHL_NAVIGATOR`
- `vw_Rental_Adoption_Terms`
- `vw_cr_items_not_in_inv_term`
- `vw_cr_locations_term`
- `vw_in_msg_dtl`
- `vw_itm_master`
- `vw_mt_fill_history`
- `vw_ord_decisions_ex`
- `vw_out_msg_dtl`
- `vw_pos_device`
- `vw_rcv_asn_po`
- `vw_rcv_open_detail`
- `vw_rental_available`
- `vw_salesmnt_unposted`

## Write statements (verbatim)

### `AutogenMR_Location`

```sql
DELETE AutogenMR_Location WHERE AutogenPOID = %ld
```

### `AutogenPO_DCCID`

```sql
DELETE AutogenPO_DCCID WHERE AutogenPOID = %ld
```

### `AutogenPO_Location`

```sql
DELETE AutogenPO_Location WHERE AutogenPOID = %ld
```

### `AutogenRet_DCCID`

```sql
DELETE AutogenRet_DCCID WHERE AutogenRetID = %ld
```

### `AutogenRet_Location`

```sql
DELETE AutogenRet_Location WHERE AutogenRetID = %ld
```

### `AutogenRet_Term`

```sql
DELETE AutogenRet_Term WHERE AutogenRetID = %ld
```

### `AutogenRet_Vendor`

```sql
DELETE AutogenRet_Vendor WHERE AutogenRetID = %ld
```

### `BIP_Temp`

```sql
delete BIP_Temp where QueryID = %ld
```

```sql
delete from BIP_Temp where QueryID = %ld
```

### `Bundle_DetailItem`

```sql
delete from Bundle_DetailItem where SKU = %d and BUNDID = %d
```

### `CMD_CatalogProductFamilies_Delete`

```sql
DELETE CMD_CatalogProductFamilies_Delete WHERE CatalogProductFamilyID IN (
```

### `CRT_Detail`

```sql
UPDATE CRT_Detail SET Qty = %d WHERE CRTDUID = %ld
```

### `CR_Detail`

```sql
Update CR_Detail SET fPrntShlfTag = 0 WHERE CourseReqID = %ld
```

### `CR_Enrollment`

```sql
DELETE CR_Enrollment WHERE EnrollmentID = %d
```

### `CR_Enrollment_Detail`

```sql
DELETE CR_Enrollment_Detail WHERE EnrollmentID = %d
```

```sql
DELETE FROM CR_Enrollment_Detail WHERE EnrollmentDtlID = %ld
```

### `CR_Locations_Detail`

```sql
DELETE CR_Locations_Detail WHERE CRLUID = %d AND DeptID = %d
```

```sql
INSERT INTO CR_Locations_Detail (CRLUID, DeptID, Pcnt) VALUES (%d, %d, %d)
```

### `CR_Shelftags`

```sql
Update CR_Shelftags Set CR_Shelftags.fPrintShelfTag = 1where CR_Shelftags.CourseReqID = %ld 
```

### `CatalogGroupOrder`

```sql
Update CatalogGroupOrder set CatalogGroupParentID = %d where CatalogID = %d
```

### `CatalogItems`

```sql
DELETE CatalogItems WHERE WasAutoAdded = 0 AND CatalogItemID IN (
```

```sql
UPDATE CatalogItems SET IsActive = 0 WHERE SKU = 
```

### `Catalog_Sales_Detail`

```sql
DELETE Catalog_Sales_Detail WHERE ReceiptDtlID = %d
```

```sql
update Catalog_Sales_Detail set fNewUsed = %ld where ReceiptDtlID = %ld
```

```sql
update Catalog_Sales_Detail set QTY = QTY + 1 where ReceiptId = %d and SKU = %d and CatalogId = %d
```

```sql
update Catalog_Sales_Detail set QTY = QTY + 1 where ReceiptId = %d and SKU = %d and CatalogId = %d %s
```

```sql
UPDATE Catalog_Sales_Detail SET SOPOID = %d WHERE ReceiptDtlID = %d
```

```sql
update Catalog_Sales_Detail set TaxCode = %d where ReceiptDtlID = %d
```

```sql
update Catalog_Sales_Detail set TaxCode = %d WHERE ReceiptDtlID in (%s)
```

```sql
update Catalog_Sales_Detail set TaxCode = (select ItemTaxTypeID from Item where SKU = %d) where ReceiptDtlID = %d
```

### `Catalog_Sales_Header`

```sql
UPDATE Catalog_Sales_Header SET fTaxExempt = 1, TaxTotal = .0000, TaxRate = 0.0000 where ReceiptID = %ld
```

```sql
update Catalog_Sales_Header set TaxTotal = %.02f where ReceiptId = %d
```

### `Catalog_Sales_Tender`

```sql
delete from Catalog_Sales_Tender where CatSaleTenderId = %d and ChargeBack = 0
```

### `Catalogs`

```sql
DELETE Catalogs WHERE CatalogID = 
```

### `Current`

```sql
Delete Current Open To Buy Record?
```

```sql
Delete Current Rental Item?
```

```sql
Delete Current Staging Receiving Record?
```

### `Customer_Address`

```sql
update Customer_Address set Address = '%s', City = '%s', State = '%s', ZipCode = '%s', Country = '%s', Phone1 = '%s', Ext1 = '%s' where CustomerAddrID = %d
```

### `Customer_Table`

```sql
update Customer_Table set FirstName = '%s', LastName = '%s', Birthdate = '%s', GovernmentIDNumber = '%s', GovernmentIDAgency = '%s' where AccountNumber = '%s'
```

### `Fiscal_Inventory_Header_Table`

```sql
UPDATE Fiscal_Inventory_Header_Table SET Batch = %d, Fixture = '%s', Area = '%s', LocationID = %ld WHERE FixtureAreaID = %ld 
```

### `IncomingMessages`

```sql
delete from IncomingMessages where MsgID = %ld
```

```sql
update IncomingMessages set FileName = replace(FileName, 'COMPLETED:', 'COMPLETED: WARNING:') where XDocHdrID = %ld
```

```sql
update IncomingMessages set Filename = replace(replace(replace(replace(replace(Filename, '(Invalid)', ''), 'ERROR: Please Click Here - ', ''), 'WARNING: Please Click Here - ', ''), 'WARNING: ', ''), 'ERROR: ', '') where XDocHdrID = %ld
```

### `Instructors_Detail`

```sql
DELETE Instructors_Detail WHERE InstructorID = %d AND DeptID = %d AND CampusID = %d 
```

```sql
INSERT INTO Instructors_Detail (InstructorID, DeptID, CampusID) VALUES (%d, %d, %d)
```

```sql
INSERT INTO Instructors_Detail (InstructorID, DeptID, CampusID, fDefaultFlg) VALUES (%d, %d, %d, 1)
```

```sql
UPDATE Instructors_Detail SET fDefaultFlg = 0 WHERE InstructorID = %d 
```

### `Item`

```sql
Delete Item
```

```sql
Delete Item (DEL)
```

### `MOFulfillmentHeader`

```sql
delete from MOFulfillmentHeader
```

### `MR_Location`

```sql
update MR_Location set DiscrQty = %d where MRDL_ID = %d
```

### `MT_Header`

```sql
delete from MT_Header where MTUID = %ld
```

### `MailOrderPinpad`

```sql
delete from MailOrderPinpad where MailOrderPinpadID = %d
```

```sql
update MailOrderPinpad set UserID = %d, LockedTime = GetDate() where MailOrderPinpadID = %d
```

```sql
update MailOrderPinpad set UserID = null, LockedTime = null where UserID = %d
```

### `MarkdownDelete_cmd`

```sql
DELETE MarkdownDelete_cmd WHERE MarkdownID = 
```

### `MarkdownItemDelete_cmd`

```sql
delete MarkdownItemDelete_cmd where MarkdownItemId in (
```

### `MarkdownSchedule`

```sql
update MarkdownSchedule set AppliedDate = getdate() where MarkdownScheduleId = 
```

### `MarkdownScheduleConfig`

```sql
delete from MarkdownScheduleConfig where MarkdownScheduleConfigId = %d
```

```sql
update MarkdownScheduleConfig set IsWriteOff = %d where MarkdownScheduleConfigId = %d
```

### `MarkdownScheduleDelete_cmd`

```sql
delete MarkdownScheduleDelete_cmd where MarkdownScheduleId in (
```

### `NBCPPeriodRetain`

```sql
delete from NBCPPeriodRetain where NBCPPeriodRetainID = %d
```

```sql
insert into NBCPPeriodRetain (RentalPID, RentalID, ShipQty) values (%d, %d, %d)
```

```sql
update NBCPPeriodRetain set ShipQty = %d where NBCPPeriodRetainID = %d
```

### `NMRPSessionRetain`

```sql
delete from NMRPSessionRetain where NMRPSessionRetainID = %d
```

```sql
insert into NMRPSessionRetain (RentalSessionID, LocationID, RentalID, KeepQty) values (%d, %d, %d, %d)
```

```sql
update NMRPSessionRetain set KeepQty = %d where NMRPSessionRetainID = %d
```

### `NMRPTransactionDetail`

```sql
update NMRPTransactionDetail set Dispatched = 2 where TranDtlID =  (select TranDtlID from Rental_History where RentalHId = %d)
```

### `OTB_DCCID`

```sql
delete from OTB_DCCID where OTBID = %d
```

### `OTB_Detail`

```sql
update OTB_Detail set %s = %s where OTBRID = %d and OTBDate > '%s'
```

### `OTB_Revision`

```sql
update OTB_Revision set Description = '%s' where OTBRID = %d
```

```sql
update OTB_Revision set DesiredTurns = %f, Margin = %f where OTBRID = %d
```

### `Order`

```sql
Update Order Decisions for Items?
```

### `Order_Decisions`

```sql
update Order_Decisions set ManualQTP = 1 where ODUID = %d
```

```sql
UPDATE Order_Decisions SET POID = %d WHERE ODUID = %d AND SKU = %d
```

### `OutgoingMessages`

```sql
delete from OutgoingMessages where MsgID = %ld
```

```sql
delete OutgoingMessages where MsgSubType = 2 and POorWantListID = %d and Status = 8
```

```sql
update OutgoingMessages set Status = 1 where MsgSubType = 2 and POorWantListID = %d
```

```sql
update OutgoingMessages set Status = 1 where XDocHdrID = %ld
```

### `PDA_WL_Request`

```sql
delete from PDA_WL_Request where WLRID = %d
```

```sql
delete from PDA_WL_Request where WLRID in (%s)
```

### `PO_BuyerLimit`

```sql
delete from PO_BuyerLimit where BLID = %d
```

```sql
insert into PO_BuyerLimit (SUID, Limit) values(%d, 0)
```

### `PO_Header`

```sql
update PO_Header set CancelDate = '%s' where POID = %d
```

```sql
update PO_Header set fStatus = 5 where POID = %d
```

### `PO_Location`

```sql
update PO_Location set DiscrQty = %d where PODL_ID = %d
```

### `PO_Vendor`

```sql
update PO_Vendor set fStatus = 0 where POID = %ld
```

```sql
update PO_Vendor set TargetID = %ld, DocTypeID = %ld,UpdateTypeID = %ld, fMakeWPInvoice = %ld, fMerged = %ld, MergeToLocationID = %ld, OrderTypeID = %ld, FillTypeID = %ld, POTrackingType = %ld,fTrackBOandCA = 1, POID1 = %ld where POID = %ld
```

### `Problem_Notifications_Detail`

```sql
DELETE FROM Problem_Notifications_Detail WHERE ProbNotifyDID = %ld
```

### `Problem_Notifications_Header`

```sql
DELETE FROM Problem_Notifications_Header WHERE 
```

### `RNRRegAssignment`

```sql
delete from RNRRegAssignment where POSID = %d
```

### `Rcv_Staging_Detail`

```sql
delete from Rcv_Staging_Detail where RCVSTDID = %d
```

```sql
insert into Rcv_Staging_Detail (RCVSTID, PurchaseId, PurchaseType) values(%d, %d, %d)
```

### `Rcv_Staging_Header`

```sql
insert into Rcv_Staging_Header (Number, UserId) values('%s', %d)
```

### `Rcv_Staging_Location`

```sql
delete from Rcv_Staging_Location where RCVSTLID = %d
```

```sql
insert into Rcv_Staging_Location (RCVSTID, RSLID, Comment) values(%d, %d, '%s')
```

```sql
update Rcv_Staging_Location set RSLID = %d, Comment = '%s' where RCVSTLID = %d
```

### `Rcv_Staging_Location_Type`

```sql
delete from Rcv_Staging_Location_Type where RSLID = %d
```

```sql
insert into Rcv_Staging_Location_Type (StagingLoc) values ('%s')
```

```sql
update Rcv_Staging_Location_Type set StagingLoc = '%s' where RSLID = %d
```

### `Rental`

```sql
Delete Rental Account?
```

### `RentalAccount`

```sql
delete from RentalAccount where RentalAccountID = %d
```

```sql
insert into RentalAccount (UserName, Password) values ('%s', '%s')
```

### `RentalAuthoFailureLog`

```sql
insert into RentalAuthoFailureLog(TransactionID, CustomerID, [Text]) values(%d, %d, '%s')
```

### `Rental_Adoption_Detail`

```sql
delete from Rental_Adoption_Detail where RentalAdoptionHeaderId = %d and Adopt = 0
```

```sql
update Rental_Adoption_Detail set Adopt = %d where RentalAdoptionHeaderId = %d
```

### `Rental_Adoption_Header`

```sql
delete from Rental_Adoption_Header where RentalAdoptionHeaderId = %d
```

### `Rental_Detail`

```sql
delete from Rental_Detail where RentalDId = %d
```

```sql
update Rental_Detail set fTagPrint = 1 %s
```

### `Rental_Email`

```sql
update Rental_Email set Text = '%s' where Type = %d
```

### `Rental_Header_Item_Period`

```sql
delete from Rental_Header_Item_Period where RHI_RP = %d
```

### `Rental_History`

```sql
update Rental_History set 
```

### `Rental_MO_Xref`

```sql
delete Rental_MO_Xref where trandtlid in               (select trandtlid from transaction_detail where transactionid = %i)
```

### `Rental_Setup_Pos`

```sql
update Rental_Setup_Pos set EmailReminderIncludePenaltyFees = %d
```

### `Rental_Term`

```sql
delete from Rental_Term where RentalPId = %d
```

```sql
insert into Rental_Term (RentalPId, TermId) values(%d, %d)
```

### `SalesHistoryHeader`

```sql
DELETE FROM SalesHistoryHeader WHERE SHMID = %ld
```

### `SalesTable`

```sql
DELETE FROM SalesTable WHERE POSID = %ld AND SalesDate = '%s'
```

### `Scheduled`

```sql
Delete Scheduled Report?
```

### `ScheduledReport`

```sql
delete from ScheduledReport where ScheduledReportID = %d
```

```sql
insert into ScheduledReport (REPUID, RSPID, DOWMask, PrintTime, fStatus, Email) values (%d, %d, %d, '%s', %d, '%s')
```

```sql
update ScheduledReport set RSPID = %d, DOWMask = %d, PrintTime = '%s', fStatus = %d, Email = '%s' where ScheduledReportID = %d
```

### `SystemParameters`

```sql
update SystemParameters set ParamValue = '%d' where ParamName = '%s'
```

```sql
update SystemParameters set ParamValue = %d where ParamType = 1013
```

```sql
update SystemParameters set ParamValue = %ld where LocationID = 0 and ParamType = 905
```

```sql
update SystemParameters set ParamValue = %ld where LocationID = 0 and ParamType = 906
```

```sql
update SystemParameters set ParamValue = %ld where LocationID = 0 and ParamType = 907
```

```sql
update SystemParameters set ParamValue = %ld where LocationID = 0 and ParamType = 914
```

```sql
update SystemParameters set ParamValue = %ld where LocationID = 0 and ParamType = 915
```

```sql
update SystemParameters set ParamValue = %ld where LocationID = 0 and ParamType = 916
```

```sql
update SystemParameters set ParamValue = 0 where LocationID = 0 and ParamType = 912
```

```sql
update SystemParameters set ParamValue = 0 where ParamType = 1013
```

```sql
update SystemParameters set ParamValue = '1697978' where LocationID = 0 and ParamType = 913
```

### `Template`

```sql
Delete Template
```

### `Transaction_Address`

```sql
update Transaction_Address set Address = '%s', City = '%s', State = '%s', ZipCode = '%s', Country = '%s', Phone1 = '%s', Ext1 = '%s' where TransactionID = %d and fShippingAddr = 0
```

### `Transaction_Detail`

```sql
DELETE Transaction_Detail WHERE TranDtlID = %d
```

```sql
update Transaction_Detail set MOfNewUsed = %ld where MOReceiptDtlID = %ld
```

```sql
UPDATE Transaction_Detail SET Qty = %d WHERE TranDtlID = %d
```

```sql
update Transaction_Detail set TaxCode = %d where TranDtlID = %d
```

```sql
update Transaction_Detail set TaxCode = %d WHERE TranDtlID in (%s)
```

```sql
update Transaction_Detail set TaxCode = (select ItemTaxTypeID from Item where SKU = %d) where TranDtlID = %d
```

### `Transaction_Header`

```sql
UPDATE Transaction_Header SET MOtxComment = '%s' WHERE MOReceiptID = %d
```

```sql
update Transaction_Header set PostVoidRcptID = %d where TransactionID = %d
```

```sql
Update Transaction_Header set ShipCharge = %.4f where TransactionId = %d
```

### `Transaction_Tender`

```sql
delete from Transaction_Tender where  TranTendorID = %d and (ChargeBack = 0 or fAuthorized = 0)
```

```sql
update Transaction_Tender set fAuthorized = 0 where TranTendorID = %d
```

### `WantListDetail`

```sql
DELETE FROM WantListDetail WHERE WantListID = %ld AND SKU = %ld AND LocationID = %ld
```

### `WantList_Location`

```sql
delete from WantList_Location where WantListID = %d and LocationID = %d
```

### `WebOrderDepositProcessLogDetail`

```sql
update WebOrderDepositProcessLogDetail set ErrorFlg = 1, Status = 'Could not authorize student''s credit card.' where TransactionID = %d
```

```sql
update WebOrderDepositProcessLogDetail set Status = 'Successfully processed.' where WODPHID = %d and TransactionID = %d
```

### `XDoc_Exceptions`

```sql
insert into XDoc_Exceptions(DocHdrID, [Text]) values(%ld, ' ' )
```

```sql
insert into XDoc_Exceptions(DocHdrID, [Text]) values(%ld, space(9) + '"Clear Warning/Error" Removes the warning/error text from the Incoming Messages Grid so it doesn''t display as Warning/Error; ')
```

```sql
insert into XDoc_Exceptions(DocHdrID, [Text]) values(%ld, space(9) + 'It does not resolve the Warning/Error condition/s that caused the Incoming Message to be displayed that way.')
```

```sql
insert into XDoc_Exceptions(DocHdrID, [Text]) values(%ld, space(9) + 'USER: ' + SYSTEM_USER + ' performed Clear Warning/Error on this response at ' + ltrim(rtrim(convert(varchar(max), GetDate()))))
```

```sql
insert into XDoc_Exceptions(DocHdrID, [Text]) values(%ld, space(9) + 'USER: "' + SYSTEM_USER + '" chose to update receiving with this %s following warning of existing receiving on PO at ' + ltrim(rtrim(convert(varchar(255), GetDate()))))
```

```sql
insert into XDoc_Exceptions(DocHdrID, [Text]) values(%ld, space(9) + 'USER: "' + SYSTEM_USER + '" performed Change Order to Accept Both New and Used on this Order at ' + ltrim(rtrim(convert(varchar(max), GetDate()))))
```

```sql
insert into XDoc_Exceptions(DocHdrID, [Text]) values(%ld, space(9) + 'USER: "' + SYSTEM_USER + '" performed Change Order to Accept Both New and Used on this Response at ' + ltrim(rtrim(convert(varchar(max), GetDate()))))
```

```sql
insert into XDoc_Exceptions(DocHdrID, [Text]) values(%ld, 'User ' + '"' + SYSTEM_USER + '" Resent ' + convert(varchar(255), getdate()))
```

```sql
insert into XDoc_Exceptions(DocHdrID, [Text]) values(%ld, 'WARNING:' )
```

```sql
insert into XDoc_Exceptions(DocHdrID, [Text]) values(%ld, 'WARNING:')
```

### `XDoc_Header`

```sql
update XDoc_Header set fExcludeFromPO = 0, ExcludeReasonID = 0 where DocHdrID = %ld
```

```sql
update XDoc_Header set FillTypeID = 3 where DocHdrID = %ld
```

### `XDoc_Log`

```sql
insert into XDoc_Log(DocHdrID, [Text])        values(%ld, space(9) + '"Clear Warning/Error" Removes the warning/error text from the Incoming Messages Grid so it doesn''t display as Warning/Error; ')
```

```sql
insert into XDoc_Log(DocHdrID, [Text])        values(%ld, space(9) + 'It does not resolve the Warning/Error condition/s that caused the Incoming Message to be displayed that way.')
```

```sql
insert into XDoc_Log(DocHdrID, [Text])        values(%ld, space(9) + 'USER: ' + SYSTEM_USER + ' performed Clear Warning/Error on this response at ' + ltrim(rtrim(convert(varchar(max), GetDate()))))
```

```sql
insert into XDoc_Log(DocHdrID, [Text]) values(%ld, ' ' )
```

```sql
insert into XDoc_Log(DocHdrID, [Text]) values(%ld, space(9) + 'USER: "' + SYSTEM_USER + '" chose to update receiving with this %s following warning of existing receiving on PO at ' + ltrim(rtrim(convert(varchar(255), GetDate()))))
```

```sql
insert into XDoc_Log(DocHdrID, [Text]) values(%ld, space(9) + 'USER: "' + SYSTEM_USER + '" performed Change Order to Accept Both New and Used on this Order at ' + ltrim(rtrim(convert(varchar(max), GetDate()))))
```

```sql
insert into XDoc_Log(DocHdrID, [Text]) values(%ld, space(9) + 'USER: "' + SYSTEM_USER + '" performed Change Order to Accept Both New and Used on this Response at ' + ltrim(rtrim(convert(varchar(max), GetDate()))))
```

```sql
insert into XDoc_Log(DocHdrID, [Text]) values(%ld, 'User ' + '"' + SYSTEM_USER + '" Resent ' + convert(varchar(255), getdate()))
```

```sql
insert into XDoc_Log(DocHdrID, [Text]) values(%ld, 'WARNING:' )
```

```sql
insert into XDoc_Log(DocHdrID, [Text]) values(%ld, 'WARNING:')
```

### `XDoc_Note`

```sql
delete from XDoc_Note where DocNoteID = %d
```

```sql
insert into XDoc_Note(Description, Text) values('%s', '%s')
```

### `XDoc_Target`

```sql
update XDoc_Target set VendorID = %ld where TargetID = %ld
```

```sql
update XDoc_Target set VendorID = %ld, NBCVendorID = %ld, CBCVendorID = %ld where TargetID = %ld
```

### `bip_temp`

```sql
insert into bip_temp(descr) values('%s')
```

```sql
update bip_temp set queryid = bpuid where bpuid = %ld
```

### `cr_course`

```sql
delete from cr_course where UCourseID = %ld
```

### `current`

```sql
Delete current Inventory Worksheet?
```

### `mt_location`

```sql
delete from mt_location where mtluid = %ld
```

### `order_decisions`

```sql
update order_decisions set fwksstatusflg = %ld where crluid = %ld and sku = %ld
```

### `problem_notifications_detail`

```sql
insert into problem_notifications_detail(probnotifyid, sku, freasonid, userid, txcomment) values(%ld, %ld, %ld, %ld, '%s')
```

```sql
update problem_notifications_detail set txcomment = txcomment + 'Linked SKU: %s' where probnotifydid = %ld
```

### `problem_notifications_header`

```sql
delete from problem_notifications_header where probnotifyid = %ld
```

```sql
insert into problem_notifications_header(termid) values(%ld)
```

### `salestable`

```sql
update salestable set typeid = %ld, salescode = %ld where stuid = %ld
```

### `selected`

```sql
Delete selected items?
```

```sql
Delete selected Messages?
```

### `tempsalestable`

```sql
delete from tempsalestable where locationid = %ld and posid = %ld and typeid = %ld and salescode = %ld and salesdate = '%s'
```

### `the`

```sql
Delete the Currently Selected User?
```

```sql
Delete the messages anyway?
```

### `this`

```sql
Delete this markdown?
```

```sql
Delete this message anyway?
```

```sql
Delete this Note ?
```

### `wantlistheader`

```sql
delete from wantlistheader where wantlistid = %ld
```

### `whl_detail`

```sql
delete from whl_detail where whluid = %ld and locationid = %ld and sku = %ld and price = %4f
```

```sql
delete from whl_detail where whluid = %ld and sku = %ld and price = %4f
```

### `wlvt`

```sql
update wlvt set fStatus = 0 from WantListVendorTerm wlvt inner join WantListVendor wlv on wlv.WLVendorID = wlvt.WLVendorID  where wlv.WantlistID = %ld
```

```sql
update wlvt set POID1 = %ld, POID2 = %ld, POTrackingType = %ld, StatusOfCreatedPOs = %ld, fCreatePOs = %ld, PONumber = '%s', TargetID = %ld from WantListVendorTerm wlvt inner join WantListVendor wlv on wlv.WLVendorID = wlvt.WLVendorID where wlv.WantlistID = %ld and wlv.VendorID = %ld and LocationID = %d and TermID = %d
```

## UI message sample (first 50)

These suggest user-facing features the binary implements.

-   - The Item may be discontinued.
-   - The SKU %d may not be part of an order decision for any location and/or term selected.
-   - The SKU may not be part of an order decision for any location and/or term selected.
-   - The Want List flag for the title may not be checked.
-   The Activity Log for this Response will list the ISBNs that were not updated
-  '%s' has already been received.
-  (Defaulting to 1)
-  Create rental for component SKU %d now?
-  MsgName like '%%%s%%'
-  The markdown will not be deleted.
- !This program cannot be run in DOS mode.
- "%s" is not a valid Expiration Date format 
- %d orders successfully processed.  %d failed.
- %d records updated.
- %d Rental Items Added.
- %d Rental Items Not Added.
- %s  - The Title may not be "Worked."
- %s cannot be deleted, an open %s exists.
- %s record already exists. Merge this record into the existing %s Record ?
- . Post the purchase order anyway?
- ; ;$;(;,;0;4;8;<;@;D;H;L;P;T;d;P?T?l?
- ? ?$?(?,?0?4?8?<?@?D?H?L?P?T?X?\?`?d?h?l?p?t?x?
- ? ?$?(?,?0?4?8?<?@?D?H?L?P?T?X?\?`?d?h?l?p?t?x?|?
- ? ?$?(?,?0?4?8?<?@?D?H?L?P?T?X?d?h?
- ? ?$?(?,?0?4?8?<?L?t?x?|?
- ? ?$?(?,?0?4?H?X?\?l?p?t?x?|?
- ? ?$?(?,?8?<?@?D?H?L?P?T?X?\?`?d?h?l?p?t?
- ? ?$?(?@?D?H?L?`?p?t?x?|?
- ? ?$?8?<?T?d?h?l?p?t?x?|?
- ? ?&?,???Y?m?
- ? ?&?,?2?8?>?D?J?P?V?\?b?h?n?t?z?
- ? ?(?4?<?\?x?
- ? ?(?4?T?\?h?
- ? ?(?8?\?d?l?t?|?
- ? ?(?L?T?\?d?t?|?
- ? ?)?3???N?v?
- ? ?/?>?M?f?t?
- ? ?'?2?D?L?x?
- ? ?@?L?l?t?|?
- ? ?<?D?L?X?`?x?
- ? ?0?@?P?`?d?t?x?
- ? ?0?@?P?`?p?
- ? ?8?A?W?]?v?
- ? ?9?I?R?]?r?y?
- ? ?D?L?T?`?h?
- ? ?D?T?\?d?l?t?|?
- = =$=(=,=0=4=8=<=@=D=P=T=0?4?8?<?@?D?H?L?P?T?X?\?`?d?h?l?p?t?x?|?
- = =,=0=T?X?\?`?d?h?l?p?t?x?|?
- > >$>(>,>0>4>8><>@>D>H>T>X>t?x?
- > >$>(>,>0>4>8><>L> ?$?(?,?0?4?8?<?@?D?H?L?P?T?X?\?`?d?h?l?p?t?x?|?

