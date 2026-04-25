# WinPRISM tables → binaries that touch them

Each table entry shows which binaries reference it and with which operations.
`SELECT` includes any FROM/JOIN exposure; `INSERT`/`UPDATE`/`DELETE` are the binary's actual write paths.

## `Acct_APCheckType`

- `WA_AP.dll` — SELECT

## `Acct_APExport`

- `WA_AP.dll` — SELECT

## `Acct_API_Detail`

- `WA_AP.dll` — DELETE, SELECT

## `Acct_API_Header`

- `WA_AP.dll` — SELECT, UPDATE

## `Acct_ARAuto_Pymt`

- `WA_AR.dll` — SELECT

## `Acct_ARAutogen_Inv`

- `WA_AR.dll` — SELECT

## `Acct_ARCalcFinChg`

- `WA_AR.dll` — SELECT

## `Acct_ARDunning`

- `WA_AR.dll` — SELECT

## `Acct_ARExport`

- `WA_AR.dll` — SELECT

## `Acct_ARInvoice_Detail`

- `WA_AR.dll` — DELETE, SELECT

## `Acct_ARInvoice_Header`

- `WA_AR.dll` — DELETE, SELECT, UPDATE

## `Acct_ARInvoice_Pymt`

- `WA_AR.dll` — DELETE, SELECT

## `Acct_ARMail_Labels`

- `WA_AR.dll` — SELECT

## `Acct_ARPurgeFinAid`

- `WA_AR.dll` — SELECT

## `Acct_ARPurgePymt`

- `WA_AR.dll` — SELECT

## `Acct_ARRptAging`

- `WA_AR.dll` — SELECT

## `Acct_ARStmt`

- `WA_AR.dll` — SELECT

## `Acct_Adjust_Detail`

- `WA_AR.dll` — DELETE, SELECT, UPDATE

## `Acct_Adjust_Header`

- `WA_AR.dll` — DELETE, SELECT, UPDATE

## `Acct_Agency`

- `WA_AR.dll` — SELECT
- `WinPrism.exe` — SELECT
- `WPTender.dll` — SELECT

## `Acct_Agency_Customer`

- `WA_AR.dll` — SELECT
- `WinPrism.exe` — SELECT

## `Acct_Agency_Group`

- `WA_AR.dll` — SELECT

## `Acct_Agency_NonMerch`

- `WA_AR.dll` — DELETE, INSERT, SELECT

## `Acct_Agency_Non_Merch_Opt`

- `WA_AR.dll` — SELECT

## `Acct_Agency_Tax_Codes`

- `WPTender.dll` — SELECT

## `Acct_Agency_Type`

- `WA_AR.dll` — SELECT

## `Acct_Auto_Acct`

- `WA_AP.dll` — DELETE, SELECT
- `WA_AR.dll` — SELECT
- `WACommon.dll` — DELETE, SELECT

## `Acct_Auto_Cust`

- `WACommon.dll` — DELETE, SELECT

## `Acct_Auto_FinDiv`

- `WACommon.dll` — DELETE, SELECT

## `Acct_Auto_Loc`

- `WA_AP.dll` — DELETE, SELECT
- `WA_AR.dll` — DELETE, SELECT
- `WACommon.dll` — DELETE, SELECT

## `Acct_Auto_Vend`

- `WACommon.dll` — DELETE, SELECT

## `Acct_COA`

- `WA_AP.dll` — SELECT
- `WinPrism.exe` — SELECT
- `WPAdmin.exe` — SELECT, UPDATE
- `WPPosCmn.dll` — SELECT

## `Acct_COA_Budget_Detail`

- `WA_GL.dll` — DELETE, SELECT

## `Acct_COA_Budget_Header`

- `WA_GL.dll` — DELETE, SELECT

## `Acct_COA_Master`

- `WPAdmin.exe` — SELECT

## `Acct_Cash_Flow_Categories`

- `WPAdmin.exe` — SELECT

## `Acct_Check_Header`

- `WA_AP.dll` — SELECT
- `WACommon.dll` — SELECT

## `Acct_Credit_Resolved_Detail`

- `WA_AP.dll` — DELETE, SELECT

## `Acct_Credit_Resolved_Header`

- `WA_AP.dll` — SELECT, UPDATE

## `Acct_Financial_Category_Type`

- `WA_GL.dll` — SELECT
- `WPAdmin.exe` — SELECT
- `WPUtility.dll` — SELECT

## `Acct_Financial_Divisions`

- `WACommon.dll` — SELECT

## `Acct_Financial_Group_Type`

- `WA_GL.dll` — SELECT

## `Acct_GLBalSheet`

- `WA_GL.dll` — SELECT

## `Acct_GLBalSheetChange`

- `WA_GL.dll` — SELECT

## `Acct_GLCashFlow`

- `WA_GL.dll` — SELECT

## `Acct_GLExport`

- `WA_GL.dll` — SELECT

## `Acct_GLIncStmt`

- `WA_GL.dll` — SELECT

## `Acct_GLJournal_Detail`

- `WA_GL.dll` — DELETE, SELECT

## `Acct_GLJournal_Header`

- `WA_GL.dll` — SELECT

## `Acct_Journal_REC_Detail`

- `WA_GL.dll` — DELETE, SELECT

## `Acct_Journal_REC_Header`

- `WA_GL.dll` — SELECT

## `Acct_Journal_Rec_Header`

- `WA_GL.dll` — SELECT

## `Acct_Memb_Account`

- `WA_AR.dll` — SELECT, UPDATE
- `WACommon.dll` — SELECT

## `Acct_Memb_Acct_Cust`

- `WA_AR.dll` — INSERT, SELECT
- `WPBuyBack.dll` — SELECT

## `Acct_Memb_Detail`

- `WA_AR.dll` — DELETE, SELECT

## `Acct_Memb_Header`

- `WA_AR.dll` — DELETE, SELECT, UPDATE

## `Acct_Memb_Mail_Labels`

- `WA_AR.dll` — SELECT

## `Acct_Memb_Setup`

- `WA_AR.dll` — SELECT

## `Acct_Memb_Setup_Card`

- `WA_AR.dll` — DELETE, SELECT

## `Acct_Memb_Stmt`

- `WA_AR.dll` — SELECT

## `Acct_Memb_Tier`

- `WA_AR.dll` — SELECT, UPDATE

## `Acct_Memb_Tier_Detail`

- `WA_AR.dll` — SELECT, UPDATE

## `Acct_Pay_Batch_Detail`

- `WA_AP.dll` — DELETE, SELECT
- `WACommon.dll` — SELECT

## `Acct_Pay_Batch_Header`

- `WA_AP.dll` — SELECT
- `WACommon.dll` — SELECT

## `Acct_Pay_Batch_header`

- `WA_AP.dll` — SELECT

## `Acct_PeriodRange`

- `WA_AR.dll` — SELECT
- `WA_GL.dll` — SELECT
- `WACommon.dll` — SELECT, UPDATE

## `Acct_Reconciliation_Types`

- `WA_AP.dll` — SELECT

## `Acct_Recurring_Expense_Header`

- `WA_AP.dll` — SELECT
- `WACommon.dll` — SELECT

## `Acct_Statement_Codes`

- `WA_AR.dll` — SELECT

## `Acct_Voucher`

- `WA_AP.dll` — SELECT
- `WACommon.dll` — SELECT

## `Acct_agency_Customer`

- `WinPrism.exe` — SELECT

## `AddressType`

- `VendMnt.dll` — SELECT
- `WPInv.dll` — SELECT

## `AutogenMR_Location`

- `WinPrism.exe` — DELETE, SELECT

## `AutogenPO`

- `WinPrism.exe` — SELECT

## `AutogenPO_DCCID`

- `WinPrism.exe` — DELETE, SELECT

## `AutogenPO_Location`

- `WinPrism.exe` — DELETE, SELECT

## `AutogenRet`

- `WinPrism.exe` — SELECT

## `AutogenRet_DCCID`

- `WinPrism.exe` — DELETE, SELECT

## `AutogenRet_Location`

- `WinPrism.exe` — DELETE, SELECT

## `AutogenRet_Term`

- `WinPrism.exe` — DELETE, SELECT

## `AutogenRet_Vendor`

- `WinPrism.exe` — DELETE, SELECT

## `BIP_Temp`

- `ItemMnt.dll` — DELETE, SELECT
- `WinPrism.exe` — DELETE, SELECT
- `WPUtility.dll` — INSERT, SELECT

## `BackOrder_Reason`

- `WinPrism.exe` — SELECT

## `Binding`

- `ItemMnt.dll` — SELECT
- `WPBuyBack.dll` — SELECT
- `WPUtility.dll` — SELECT

## `Binding_ONIX`

- `ItemMnt.dll` — SELECT

## `BookRouting`

- `WPBuyBack.dll` — SELECT, UPDATE

## `BookRoutingConfig`

- `WPBuyBack.dll` — SELECT, UPDATE

## `BookRoutingConfigTerm`

- `WPBuyBack.dll` — DELETE, INSERT, SELECT

## `BundleTran_vw`

- `WinPrism.exe` — SELECT

## `BundleTrans_Header`

- `WPComm.dll` — SELECT

## `Bundle_Detail`

- `WPBuyBack.dll` — DELETE, SELECT

## `Bundle_DetailItem`

- `ItemMnt.dll` — SELECT
- `WinPrism.exe` — DELETE, SELECT
- `WPBuyBack.dll` — DELETE, SELECT

## `Bundle_Header`

- `WPBuyBack.dll` — DELETE, SELECT

## `Buyback_Buyer_Groups`

- `WPBuyBack.dll` — DELETE, SELECT

## `Buyback_Buyer_Location`

- `WPBuyBack.dll` — DELETE, SELECT

## `Buyback_Buyers`

- `WPBuyBack.dll` — DELETE, SELECT

## `Buyback_Condition`

- `WPBuyBack.dll` — SELECT

## `Buyback_Detail`

- `WPAdmin.exe` — SELECT
- `WPBuyBack.dll` — DELETE, INSERT, SELECT, UPDATE
- `WPUtility.dll` — SELECT, UPDATE

## `Buyback_Errors`

- `WPBuyBack.dll` — DELETE, INSERT, SELECT

## `Buyback_Header`

- `WPBuyBack.dll` — SELECT, UPDATE
- `WPComm.dll` — SELECT

## `Buyback_InvRec_Checks`

- `WPBuyBack.dll` — DELETE, SELECT

## `Buyback_InvRec_Store`

- `WPBuyBack.dll` — DELETE, SELECT

## `Buyback_InvRec_Student`

- `WPBuyBack.dll` — DELETE, SELECT

## `Buyback_List_Create`

- `WPBuyBack.dll` — DELETE, SELECT

## `Buyback_List_Detail`

- `WPBuyBack.dll` — DELETE, SELECT, UPDATE

## `Buyback_List_Header`

- `WPBuyBack.dll` — DELETE, SELECT, UPDATE

## `Buyback_List_Item`

- `WPBuyBack.dll` — DELETE, SELECT, UPDATE
- `WPUtility.dll` — SELECT

## `Buyback_List_detail`

- `WPBuyBack.dll` — SELECT

## `Buyback_List_item`

- `WPBuyBack.dll` — SELECT

## `Buyback_New_Item`

- `WPBuyBack.dll` — DELETE, INSERT, SELECT

## `Buyback_New_item`

- `WPBuyBack.dll` — SELECT

## `Buyback_Purchaser`

- `WPAdmin.exe` — SELECT
- `WPBuyBack.dll` — SELECT

## `Buyback_QuickRef`

- `WPBuyBack.dll` — DELETE, INSERT, SELECT, UPDATE

## `Buyback_Receipt_Printers`

- `WinPrism.exe` — SELECT

## `Buyback_Session`

- `WPAdmin.exe` — SELECT
- `WPBuyBack.dll` — SELECT

## `Buyback_Session_Location`

- `WPBuyBack.dll` — INSERT, SELECT

## `Buyback_Session_Purchasers`

- `WPAdmin.exe` — SELECT
- `WPBuyBack.dll` — SELECT, UPDATE

## `Buyback_Stolen_Books`

- `WPBuyBack.dll` — DELETE, SELECT

## `Buyback_WorkStations`

- `WPBuyBack.dll` — SELECT

## `Buyback_Workstations`

- `WPBuyBack.dll` — SELECT

## `Buyback_session`

- `WPAdmin.exe` — SELECT

## `Buyers_Guide_Adopted`

- `WPAdmin.exe` — DELETE, SELECT
- `WPUtility.dll` — SELECT

## `Buyers_Guide_Extended`

- `WPAdmin.exe` — INSERT, SELECT

## `Buyers_Guide_Report`

- `WPAdmin.exe` — DELETE, SELECT

## `Buyers_Guide_Table`

- `WinPrism.exe` — SELECT
- `WPBuyBack.dll` — DELETE, SELECT
- `WPUtility.dll` — SELECT

## `Buyers_Guide_Vendor_Commission`

- `WinPrism.exe` — SELECT
- `WPAdmin.exe` — SELECT, UPDATE
- `WPBuyBack.dll` — SELECT

## `Buyers_Guide_Vendors`

- `WinPrism.exe` — SELECT
- `WPBuyBack.dll` — SELECT
- `WPUtility.dll` — SELECT

## `Buyers_Guide_table`

- `WPBuyBack.dll` — SELECT

## `Buyers_guide_vendors`

- `WPBuyBack.dll` — SELECT

## `CD_AcctReasons`

- `WPInv.dll` — SELECT

## `CD_Detail`

- `WinPrism.exe` — SELECT
- `WPUtility.dll` — SELECT

## `CD_Header`

- `WA_AP.dll` — SELECT
- `WinPrism.exe` — SELECT
- `WPUtility.dll` — SELECT

## `CD_Reasons`

- `WPInv.dll` — SELECT
- `WPUtility.dll` — SELECT, UPDATE

## `CMD_CatalogProductFamilies_Delete`

- `WinPrism.exe` — DELETE, SELECT

## `CMD_SalesEventItems_Delete`

- `WPUtility.dll` — DELETE, SELECT

## `CRCourseLevel`

- `WinPrism.exe` — SELECT

## `CRT_Detail`

- `WinPrism.exe` — SELECT, UPDATE
- `WPCredit.dll` — SELECT

## `CRT_Header`

- `WinPrism.exe` — SELECT
- `WPCredit.dll` — SELECT
- `WPUtility.dll` — SELECT

## `CR_Campus`

- `WinPrism.exe` — SELECT

## `CR_Course`

- `WinPrism.exe` — SELECT
- `WPUtility.dll` — SELECT

## `CR_DEPARTMENT`

- `WinPrism.exe` — SELECT

## `CR_Department`

- `WinPrism.exe` — SELECT
- `WPBuyBack.dll` — SELECT
- `WPUtility.dll` — SELECT

## `CR_Detail`

- `WinPrism.exe` — SELECT, UPDATE

## `CR_Detail_Options`

- `WinPrism.exe` — SELECT

## `CR_Enrollment`

- `WinPrism.exe` — DELETE, SELECT

## `CR_Enrollment_Detail`

- `WinPrism.exe` — DELETE, SELECT

## `CR_Header`

- `WinPrism.exe` — SELECT
- `WPUtility.dll` — SELECT

## `CR_Locations`

- `WinPrism.exe` — SELECT
- `WPBuyBack.dll` — SELECT, UPDATE
- `WPUtility.dll` — SELECT

## `CR_Locations_Detail`

- `WinPrism.exe` — DELETE, INSERT, SELECT
- `WPUtility.dll` — SELECT

## `CR_Shelftags`

- `WinPrism.exe` — SELECT, UPDATE

## `CR_Term`

- `WinPrism.exe` — SELECT
- `WPBuyBack.dll` — SELECT
- `WPUtility.dll` — SELECT

## `CR_ZeroSkuDetail`

- `WinPrism.exe` — SELECT

## `Calculate`

- `WA_AR.dll` — DELETE, SELECT

## `Cash_Cnt_Counts`

- `WPPosCmn.dll` — DELETE, INSERT, SELECT, UPDATE

## `Cash_Cnt_Group_Loc`

- `WPPosCmn.dll` — DELETE, SELECT

## `Cash_Cnt_Groups`

- `WPPosCmn.dll` — DELETE, SELECT

## `Cash_Cnt_Results`

- `WPPosCmn.dll` — DELETE, SELECT

## `CatalogAux`

- `WinPrism.exe` — SELECT

## `CatalogGroupOrder`

- `WinPrism.exe` — SELECT, UPDATE
- `WPAdmin.exe` — SELECT, UPDATE

## `CatalogGroupOrder_vw`

- `WPAdmin.exe` — SELECT

## `CatalogGroups`

- `WinPrism.exe` — SELECT
- `WPAdmin.exe` — DELETE, SELECT

## `CatalogItems`

- `WinPrism.exe` — DELETE, SELECT, UPDATE
- `WPUtility.dll` — SELECT

## `CatalogProductFamilies`

- `WinPrism.exe` — SELECT

## `CatalogProductFamilyAux`

- `WinPrism.exe` — SELECT

## `CatalogTypes`

- `WinPrism.exe` — SELECT

## `Catalog_Sales_Detail`

- `WinPrism.exe` — DELETE, SELECT, UPDATE
- `WPComm.dll` — SELECT

## `Catalog_Sales_Header`

- `WinPrism.exe` — SELECT, UPDATE
- `WPComm.dll` — SELECT, UPDATE
- `WPUtility.dll` — SELECT

## `Catalog_Sales_Tender`

- `WinPrism.exe` — DELETE, SELECT

## `Catalog_Sales_detail`

- `WPComm.dll` — SELECT

## `Catalogs`

- `WinPrism.exe` — DELETE, SELECT

## `Color`

- `ItemMnt.dll` — SELECT
- `WPUtility.dll` — SELECT, UPDATE

## `Country`

- `WPPosCmn.dll` — SELECT

## `Course_Selection`

- `WPUtility.dll` — DELETE, INSERT, SELECT, UPDATE

## `Credit_Resolved_Detail`

- `WPCredit.dll` — SELECT

## `Currency_Exchange`

- `VendMnt.dll` — SELECT
- `WPAdmin.exe` — SELECT
- `WPBuyBack.dll` — SELECT
- `WPPosCmn.dll` — SELECT
- `WPUtility.dll` — SELECT

## `Current`

- `ItemMnt.dll` — DELETE, SELECT
- `WinPrism.exe` — DELETE, SELECT
- `WPAdmin.exe` — DELETE, SELECT
- `WPUtility.dll` — DELETE, SELECT

## `Custom_Reports`

- `WPAdmin.exe` — SELECT

## `Customer_Address`

- `WinPrism.exe` — SELECT, UPDATE
- `WPBuyBack.dll` — SELECT
- `WPComm.dll` — SELECT

## `Customer_Location`

- `WinPrism.exe` — SELECT

## `Customer_Table`

- `WA_AR.dll` — SELECT, UPDATE
- `WinPrism.exe` — SELECT, UPDATE
- `WPBuyBack.dll` — SELECT
- `WPComm.dll` — SELECT
- `WPTender.dll` — SELECT
- `WPUtility.dll` — SELECT

## `DCCGLCode`

- `WPAdmin.exe` — INSERT, SELECT

## `DCCGLCodeType`

- `WPAdmin.exe` — SELECT

## `DCCLocation`

- `WPAdmin.exe` — SELECT

## `DCC_Category`

- `WPAdmin.exe` — INSERT, SELECT, UPDATE
- `WPUtility.dll` — SELECT

## `DCC_Class`

- `WPAdmin.exe` — DELETE, INSERT, SELECT, UPDATE
- `WPUtility.dll` — SELECT

## `DCC_Department`

- `WPAdmin.exe` — DELETE, INSERT, SELECT, UPDATE
- `WPUtility.dll` — SELECT

## `DCC_Selection`

- `WPUtility.dll` — DELETE, INSERT, SELECT, UPDATE

## `DccLocationRoyaltySet_vw`

- `WPData.dll` — SELECT, UPDATE

## `DeptClassCat`

- `WPAdmin.exe` — DELETE, INSERT, SELECT, UPDATE
- `WPUtility.dll` — SELECT

## `DigitalTxtDetail`

- `ItemMnt.dll` — SELECT

## `DigitalTxtHeader`

- `ItemMnt.dll` — DELETE, SELECT
- `WinPrism.exe` — SELECT

## `DigitalTxtInstructions`

- `ItemMnt.dll` — SELECT

## `Discount_Codes`

- `WA_AR.dll` — SELECT
- `WPPosCmn.dll` — DELETE, SELECT

## `Discount_Codes_Location`

- `WPPosCmn.dll` — DELETE, SELECT

## `Discount_Codes_Method`

- `WPPosCmn.dll` — SELECT

## `Discount_Codes_Type`

- `WA_AR.dll` — SELECT
- `WPPosCmn.dll` — SELECT

## `Discrepancy`

- `WPInv.dll` — DELETE, SELECT

## `Dunning`

- `WA_AR.dll` — DELETE, SELECT

## `EQFunction`

- `WPBuyBack.dll` — SELECT, UPDATE
- `WPUtility.dll` — SELECT

## `EQListData`

- `ItemMnt.dll` — SELECT
- `WPUtility.dll` — DELETE, SELECT

## `E_VW_PO_EMAILS`

- `WinPrism.exe` — SELECT

## `EmailTemplate`

- `WPUtility.dll` — DELETE, SELECT

## `Entire`

- `WA_AR.dll` — DELETE, SELECT

## `Export`

- `WA_AR.dll` — DELETE, SELECT

## `FROM`

- `WPPosCmn.dll` — DELETE, SELECT

## `Fiscal_Inventory_Header_Table`

- `WinPrism.exe` — SELECT, UPDATE

## `Freight_Invoice_Detail`

- `WPInv.dll` — DELETE, SELECT

## `Freight_Invoice_Header`

- `WA_AP.dll` — SELECT
- `WPInv.dll` — SELECT

## `GMSize`

- `ItemMnt.dll` — SELECT
- `WPUtility.dll` — SELECT, UPDATE

## `GblComment`

- `ItemMnt.dll` — SELECT
- `WPTender.dll` — SELECT, UPDATE

## `GeneralMerchandise`

- `ItemMnt.dll` — DELETE, SELECT
- `WinPrism.exe` — SELECT
- `WPBuyBack.dll` — INSERT, SELECT
- `WPUtility.dll` — SELECT

## `GraphicComponentTypes`

- `WPAdmin.exe` — SELECT, UPDATE

## `Group`

- `WPAdmin.exe` — DELETE, SELECT

## `ImportLog`

- `ItemMnt.dll` — SELECT

## `IncomingMessages`

- `WinPrism.exe` — DELETE, SELECT, UPDATE

## `Instructors`

- `WinPrism.exe` — SELECT

## `Instructors_Detail`

- `WinPrism.exe` — DELETE, INSERT, SELECT, UPDATE

## `Inv_POVendor`

- `ItemMnt.dll` — DELETE, INSERT, SELECT

## `Inv_ShelfLocations`

- `ItemMnt.dll` — SELECT

## `Inventory`

- `ItemMnt.dll` — DELETE, SELECT
- `WinPrism.exe` — SELECT
- `WPBuyBack.dll` — INSERT, SELECT
- `WPUtility.dll` — SELECT

## `InventoryStatusCodes`

- `ItemMnt.dll` — SELECT
- `WPUtility.dll` — SELECT

## `Inventory_NonMerch`

- `ItemMnt.dll` — DELETE, INSERT, SELECT
- `WinPrism.exe` — SELECT

## `Invoice_Detail`

- `WPInv.dll` — SELECT, UPDATE

## `Invoice_Header`

- `WA_AP.dll` — SELECT
- `WPInv.dll` — SELECT

## `Invoice_Location`

- `WinPrism.exe` — SELECT
- `WPCredit.dll` — SELECT
- `WPInv.dll` — SELECT, UPDATE
- `WPUtility.dll` — SELECT

## `Item`

- `ItemMnt.dll` — SELECT, UPDATE
- `WinPrism.exe` — DELETE, SELECT
- `WPBuyBack.dll` — INSERT, SELECT
- `WPInv.dll` — SELECT
- `WPUtility.dll` — SELECT

## `ItemFindSettings`

- `WPUtility.dll` — SELECT

## `ItemMaster`

- `WinPrism.exe` — SELECT
- `WPBuyBack.dll` — SELECT
- `WPInv.dll` — SELECT

## `ItemSeasonCodes`

- `ItemMnt.dll` — SELECT
- `WPUtility.dll` — SELECT, UPDATE

## `Item_Components_Detail`

- `ItemMnt.dll` — SELECT, UPDATE
- `WPComm.dll` — SELECT

## `Item_Components_Header`

- `ItemMnt.dll` — SELECT
- `WPComm.dll` — SELECT

## `Item_Tax_Type`

- `ItemMnt.dll` — SELECT
- `WinPrism.exe` — SELECT
- `WPAdmin.exe` — SELECT
- `WPPosCmn.dll` — DELETE, SELECT

## `Item_Tax_Type_Grouping`

- `WPPosCmn.dll` — DELETE, INSERT, SELECT

## `Item_XREF`

- `ItemMnt.dll` — DELETE, SELECT

## `Item_XRef_Dups`

- `WPUtility.dll` — SELECT

## `Item_Xref`

- `ItemMnt.dll` — DELETE, INSERT, SELECT, UPDATE

## `Item_Xref_Dups`

- `WPUtility.dll` — DELETE, SELECT

## `Letter`

- `WA_AR.dll` — DELETE, SELECT

## `Location`

- `ItemMnt.dll` — SELECT
- `VendMnt.dll` — SELECT
- `WA_AP.dll` — SELECT
- `WA_AR.dll` — SELECT
- `WA_GL.dll` — SELECT
- `WinPrism.exe` — SELECT
- `WPAdmin.exe` — SELECT
- `WPBuyBack.dll` — SELECT
- `WPInv.dll` — SELECT
- `WPPosCmn.dll` — SELECT
- `WPUtility.dll` — SELECT

## `LocationSelectionLocations`

- `WinPrism.exe` — SELECT
- `WPUtility.dll` — DELETE, SELECT

## `LocationSelectionViews`

- `WPUtility.dll` — SELECT

## `LocationSelections`

- `WPUtility.dll` — DELETE, SELECT, UPDATE

## `Location_Group_Types`

- `WPAdmin.exe` — SELECT

## `Location_Grouping`

- `WPAdmin.exe` — SELECT
- `WPUtility.dll` — SELECT

## `Location_Groups`

- `WPAdmin.exe` — SELECT, UPDATE
- `WPUtility.dll` — SELECT

## `MOFulfillmentHeader`

- `WinPrism.exe` — DELETE, SELECT

## `MORefundRentalTranDtl_vw`

- `WPComm.dll` — SELECT

## `MO_Discount_Codes`

- `WinPrism.exe` — SELECT

## `MO_Email`

- `WinPrism.exe` — SELECT

## `MO_Shipping_Codes`

- `WinPrism.exe` — SELECT
- `WPAdmin.exe` — SELECT
- `WPComm.dll` — SELECT

## `MO_Shipping_Codes_Location`

- `WPAdmin.exe` — DELETE, SELECT

## `MO_Shipping_Details`

- `WPAdmin.exe` — DELETE, SELECT

## `MO_Shipping_FillType`

- `WinPrism.exe` — SELECT

## `MO_Shipping_Interface`

- `WPAdmin.exe` — SELECT

## `MO_Shipping_Methods`

- `WPAdmin.exe` — SELECT

## `MR_Detail`

- `WinPrism.exe` — SELECT

## `MR_Header`

- `WinPrism.exe` — SELECT

## `MR_Location`

- `WinPrism.exe` — SELECT, UPDATE

## `MR_ShipTypes`

- `WinPrism.exe` — SELECT

## `MT_Detail`

- `WinPrism.exe` — SELECT

## `MT_HEADER`

- `WPUtility.dll` — SELECT

## `MT_Header`

- `WinPrism.exe` — DELETE, SELECT
- `WPUtility.dll` — SELECT

## `MailOrderPinpad`

- `WinPrism.exe` — DELETE, SELECT, UPDATE

## `Mailing`

- `WA_AR.dll` — DELETE, SELECT

## `MarkdownAux`

- `WinPrism.exe` — SELECT

## `MarkdownDelete_cmd`

- `WinPrism.exe` — DELETE, SELECT

## `MarkdownItemDelete_cmd`

- `WinPrism.exe` — DELETE, SELECT

## `MarkdownItemLocation`

- `WinPrism.exe` — SELECT

## `MarkdownSchedule`

- `WinPrism.exe` — SELECT, UPDATE

## `MarkdownScheduleConfig`

- `WinPrism.exe` — DELETE, SELECT, UPDATE

## `MarkdownScheduleConfigDetail`

- `WinPrism.exe` — SELECT

## `MarkdownScheduleDelete_cmd`

- `WinPrism.exe` — DELETE, SELECT

## `Mathews_Books`

- `WinPrism.exe` — SELECT
- `WPUtility.dll` — SELECT

## `Mathews_books`

- `WPUtility.dll` — SELECT

## `Matrix_Attrib`

- `ItemMnt.dll` — SELECT

## `Matrix_Attrib_Order`

- `ItemMnt.dll` — DELETE, INSERT, SELECT

## `Matrix_Detail`

- `WPUtility.dll` — SELECT

## `Matrix_Header`

- `WinPrism.exe` — SELECT
- `WPUtility.dll` — SELECT

## `MediaDisplayTypes`

- `WPUtility.dll` — SELECT

## `MediaTypes`

- `WPUtility.dll` — SELECT

## `ModuleLocking`

- `WPAdmin.exe` — DELETE, SELECT
- `WPComm.dll` — DELETE, INSERT, SELECT

## `Monarch_Printers`

- `WinPrism.exe` — SELECT

## `MonsoonMarketplaces`

- `WPAdmin.exe` — DELETE, SELECT

## `MsgReportType`

- `WinPrism.exe` — SELECT

## `MsgSubType`

- `WinPrism.exe` — SELECT

## `NBCPGetReconcileSessions_vw`

- `WinPrism.exe` — SELECT

## `NBCPPeriodRetain`

- `WinPrism.exe` — DELETE, INSERT, SELECT, UPDATE

## `NMRPCustomerDialog_vw`

- `WinPrism.exe` — SELECT

## `NMRPSessionRetain`

- `WinPrism.exe` — DELETE, INSERT, SELECT, UPDATE

## `NMRPTransactionDetail`

- `WinPrism.exe` — SELECT, UPDATE
- `WPComm.dll` — SELECT

## `OTB_DCCID`

- `WinPrism.exe` — DELETE, SELECT

## `OTB_Detail`

- `WinPrism.exe` — SELECT, UPDATE

## `OTB_Header`

- `WinPrism.exe` — SELECT

## `OTB_Location`

- `WinPrism.exe` — SELECT

## `OTB_Revision`

- `WinPrism.exe` — SELECT, UPDATE

## `OldPassword`

- `WPAdmin.exe` — INSERT, SELECT

## `OnHold`

- `ItemMnt.dll` — DELETE, INSERT, SELECT

## `OnHoldType`

- `ItemMnt.dll` — INSERT, SELECT

## `OposLog`

- `WPComm.dll` — INSERT, SELECT

## `Order`

- `WinPrism.exe` — SELECT, UPDATE

## `Order_Decisions`

- `WinPrism.exe` — SELECT, UPDATE

## `OutgoingMessages`

- `WinPrism.exe` — DELETE, SELECT, UPDATE
- `WPUtility.dll` — INSERT, SELECT

## `PDA_WL_Request`

- `WinPrism.exe` — DELETE, SELECT

## `POS_Cash_Count_Shifts`

- `WPPosCmn.dll` — DELETE, INSERT, SELECT, UPDATE

## `POS_DCC_Methods`

- `WPPosCmn.dll` — SELECT

## `POS_Device`

- `WPComm.dll` — SELECT

## `POS_Fee_Code_Type`

- `WPPosCmn.dll` — SELECT

## `POS_Fee_Codes`

- `ItemMnt.dll` — SELECT
- `WinPrism.exe` — SELECT
- `WPPosCmn.dll` — DELETE, SELECT

## `POS_Groups`

- `WPPosCmn.dll` — SELECT
- `WPTender.dll` — SELECT

## `POS_Keyboard_Mapping_Groups`

- `WPPosCmn.dll` — DELETE, SELECT

## `POS_Keyboard_Mappings`

- `WPPosCmn.dll` — DELETE, SELECT
- `WPTender.dll` — SELECT

## `POS_MSR_Card_Types`

- `WA_AR.dll` — SELECT
- `WinPrism.exe` — SELECT
- `WPPosCmn.dll` — DELETE, SELECT

## `POS_MSR_Options`

- `WPComm.dll` — SELECT
- `WPPosCmn.dll` — DELETE, SELECT

## `POS_Open_History`

- `WPPosCmn.dll` — DELETE, SELECT

## `POS_Open_history`

- `WPPosCmn.dll` — SELECT

## `POS_QuickSKU`

- `WPPosCmn.dll` — DELETE, SELECT

## `POS_Receipt_Barcode_Types`

- `WPPosCmn.dll` — SELECT

## `POS_Receipt_Fonts`

- `WPPosCmn.dll` — SELECT

## `POS_Receipt_Footer`

- `WPPosCmn.dll` — DELETE, SELECT

## `POS_Receipt_Header`

- `WPPosCmn.dll` — DELETE, SELECT

## `POS_Receipt_Template_Options`

- `WPPosCmn.dll` — DELETE, SELECT

## `POS_Receipt_Templates`

- `WPPosCmn.dll` — DELETE, SELECT

## `POS_Receipt_Types`

- `WPComm.dll` — SELECT
- `WPPosCmn.dll` — SELECT
- `WPUtility.dll` — SELECT

## `POS_Reg_Groupings`

- `WPPosCmn.dll` — DELETE, SELECT

## `POS_Register_Access`

- `WPPosCmn.dll` — DELETE, SELECT, UPDATE
- `WPTender.dll` — SELECT

## `POS_Register_Access_History`

- `WPPosCmn.dll` — SELECT, UPDATE

## `POS_Register_Templates`

- `WPComm.dll` — SELECT
- `WPPosCmn.dll` — DELETE, SELECT

## `POS_Register_Type`

- `WPPosCmn.dll` — SELECT

## `POS_Registers`

- `WA_AR.dll` — SELECT
- `WPComm.dll` — SELECT
- `WPPosCmn.dll` — DELETE, SELECT
- `WPTender.dll` — SELECT

## `POS_SetUP`

- `WPUtility.dll` — SELECT

## `POS_Setup`

- `WA_AR.dll` — SELECT
- `WPComm.dll` — SELECT
- `WPPosCmn.dll` — DELETE, SELECT

## `POS_Sig_Types`

- `WPPosCmn.dll` — SELECT

## `POS_Trans_Security_Level`

- `WPPosCmn.dll` — SELECT

## `POS_Trans_Types`

- `WPPosCmn.dll` — DELETE, SELECT

## `POS_Trans_Types_Location`

- `WPPosCmn.dll` — DELETE, SELECT

## `POS_Update_Download_Type`

- `WPAdmin.exe` — SELECT

## `POS_setup`

- `WPPosCmn.dll` — SELECT

## `PO_BuyerLimit`

- `WinPrism.exe` — DELETE, INSERT, SELECT

## `PO_Detail`

- `WinPrism.exe` — SELECT
- `WPUtility.dll` — SELECT

## `PO_Header`

- `WinPrism.exe` — SELECT, UPDATE
- `WPUtility.dll` — SELECT

## `PO_LOCATION`

- `WinPrism.exe` — SELECT

## `PO_Location`

- `WinPrism.exe` — SELECT, UPDATE
- `WPUtility.dll` — SELECT

## `PO_Style_Location_Components`

- `WPUtility.dll` — SELECT, UPDATE

## `PO_Vendor`

- `WinPrism.exe` — SELECT, UPDATE

## `PackageDetail`

- `ItemMnt.dll` — SELECT
- `WPUtility.dll` — SELECT

## `PackageHeader`

- `ItemMnt.dll` — DELETE, SELECT
- `WPUtility.dll` — SELECT

## `PackageType`

- `ItemMnt.dll` — SELECT
- `WinPrism.exe` — SELECT

## `PaperType`

- `WPAdmin.exe` — SELECT

## `Pos_Group_Types`

- `WPPosCmn.dll` — SELECT

## `Pos_Setup`

- `WA_AR.dll` — SELECT
- `WinPrism.exe` — SELECT
- `WPAdmin.exe` — SELECT
- `WPComm.dll` — SELECT
- `WPPosCmn.dll` — SELECT

## `Pos_Setup_DistType`

- `WPPosCmn.dll` — SELECT

## `PriceModificationRoundingDirections`

- `WPUtility.dll` — SELECT

## `PriceModificationRoundingTargets`

- `WPUtility.dll` — SELECT

## `Price_Change_DCCID`

- `ItemMnt.dll` — DELETE, SELECT

## `Price_Change_Detail`

- `ItemMnt.dll` — DELETE, SELECT

## `Price_Change_Location`

- `ItemMnt.dll` — SELECT

## `Price_Change_Table`

- `ItemMnt.dll` — INSERT, SELECT, UPDATE

## `Prism_Security`

- `WinPrism.exe` — SELECT
- `WPAdmin.exe` — DELETE, SELECT

## `Problem_Notifications_Detail`

- `WinPrism.exe` — DELETE, SELECT

## `Problem_Notifications_Header`

- `WinPrism.exe` — DELETE, SELECT

## `Problem_Notifications_Reasons`

- `WPUtility.dll` — SELECT, UPDATE

## `Pubnet_Values`

- `WPAdmin.exe` — SELECT

## `Purch_AddConfig`

- `WinPrism.exe` — SELECT
- `WPUtility.dll` — SELECT

## `Purch_AddConfig_Location`

- `WPUtility.dll` — DELETE, SELECT

## `Purge`

- `WA_AR.dll` — DELETE, SELECT

## `Quick`

- `WPBuyBack.dll` — DELETE, SELECT

## `QuickSearchType`

- `WinPrism.exe` — SELECT
- `WPInv.dll` — SELECT
- `WPUtility.dll` — SELECT

## `RNRRegAssignment`

- `WinPrism.exe` — DELETE, SELECT

## `Rcv_Staging_Detail`

- `WinPrism.exe` — DELETE, INSERT, SELECT

## `Rcv_Staging_Header`

- `WinPrism.exe` — INSERT, SELECT

## `Rcv_Staging_Location`

- `WinPrism.exe` — DELETE, INSERT, SELECT, UPDATE

## `Rcv_Staging_Location_Type`

- `WinPrism.exe` — DELETE, INSERT, SELECT, UPDATE

## `Reason_Code`

- `WinPrism.exe` — SELECT
- `WPUtility.dll` — SELECT

## `Recurrence`

- `WinPrism.exe` — SELECT

## `Recurrence_Ordinals`

- `WPUtility.dll` — SELECT

## `Recurrence_Patterns`

- `WPUtility.dll` — SELECT

## `Rental`

- `WinPrism.exe` — DELETE, SELECT

## `RentalAccount`

- `WinPrism.exe` — DELETE, INSERT, SELECT

## `RentalAuthoFailureLog`

- `WinPrism.exe` — INSERT, SELECT

## `RentalPeriodSession_vw`

- `WinPrism.exe` — SELECT

## `RentalSession`

- `WinPrism.exe` — SELECT

## `RentalSessionAccount`

- `WinPrism.exe` — SELECT

## `Rental_Adoption_Detail`

- `WinPrism.exe` — DELETE, SELECT, UPDATE

## `Rental_Adoption_Header`

- `WinPrism.exe` — DELETE, SELECT
- `WPComm.dll` — SELECT

## `Rental_Detail`

- `WinPrism.exe` — DELETE, SELECT, UPDATE
- `WPBuyBack.dll` — SELECT

## `Rental_Email`

- `WinPrism.exe` — SELECT, UPDATE

## `Rental_Header_Item`

- `ItemMnt.dll` — SELECT
- `WinPrism.exe` — SELECT
- `WPComm.dll` — SELECT

## `Rental_Header_Item_Period`

- `WinPrism.exe` — DELETE, SELECT
- `WPBuyBack.dll` — SELECT

## `Rental_History`

- `WinPrism.exe` — SELECT, UPDATE
- `WPBuyBack.dll` — SELECT
- `WPComm.dll` — SELECT

## `Rental_MO_Xref`

- `WinPrism.exe` — DELETE, SELECT
- `WPComm.dll` — DELETE, SELECT

## `Rental_Period`

- `WinPrism.exe` — SELECT

## `Rental_Setup_Main`

- `WinPrism.exe` — SELECT

## `Rental_Setup_POS`

- `WinPrism.exe` — SELECT
- `WPTender.dll` — SELECT

## `Rental_Setup_Pos`

- `WinPrism.exe` — SELECT, UPDATE
- `WPComm.dll` — SELECT

## `Rental_TagType`

- `WinPrism.exe` — SELECT

## `Rental_Term`

- `WinPrism.exe` — DELETE, INSERT, SELECT

## `ReportCustom`

- `WinPrism.exe` — SELECT
- `WPAdmin.exe` — SELECT
- `WPComm.dll` — SELECT
- `WPUtility.dll` — SELECT

## `ReportGenGroup`

- `WPUtility.dll` — DELETE, SELECT

## `ReportGenGroupSummary`

- `WPUtility.dll` — DELETE, SELECT

## `ReportGenHeader`

- `WinPrism.exe` — SELECT
- `WPUtility.dll` — SELECT

## `ReportGenTemplate`

- `WPUtility.dll` — SELECT

## `ReportHeaderColor`

- `WPUtility.dll` — SELECT

## `ReportLogo`

- `WPUtility.dll` — SELECT, UPDATE

## `ReportMaster`

- `WinPrism.exe` — SELECT
- `WPAdmin.exe` — SELECT
- `WPComm.dll` — SELECT
- `WPUtility.dll` — SELECT

## `ReportParams`

- `WinPrism.exe` — SELECT
- `WPAdmin.exe` — INSERT, SELECT

## `ReportSelectionValue`

- `WPUtility.dll` — INSERT, SELECT

## `ReportSortOptions`

- `WinPrism.exe` — SELECT
- `WPAdmin.exe` — INSERT, SELECT
- `WPUtility.dll` — SELECT

## `Report_SaveParams_Course`

- `WPUtility.dll` — DELETE, INSERT, SELECT

## `Report_SaveParams_DCC`

- `WPUtility.dll` — DELETE, INSERT, SELECT

## `Report_SaveParams_Detail`

- `WinPrism.exe` — SELECT
- `WPUtility.dll` — SELECT

## `Report_SaveParams_Header`

- `WinPrism.exe` — SELECT
- `WPUtility.dll` — SELECT

## `ResolveTextbookSku_vw`

- `WinPrism.exe` — SELECT

## `ResolveTradebookSku_vw`

- `WinPrism.exe` — SELECT

## `ReturnPolicy`

- `VendMnt.dll` — SELECT
- `WinPrism.exe` — SELECT

## `SalesEventAux`

- `WPUtility.dll` — SELECT

## `SalesEventItemLocations`

- `WPUtility.dll` — SELECT, UPDATE

## `SalesEventItems`

- `WPUtility.dll` — SELECT

## `SalesEvents`

- `WPUtility.dll` — DELETE, SELECT

## `SalesHistoryHeader`

- `WinPrism.exe` — DELETE, SELECT

## `SalesHistoryType`

- `WinPrism.exe` — SELECT

## `SalesTable`

- `WinPrism.exe` — DELETE, SELECT

## `SalesTypes`

- `WPComm.dll` — SELECT

## `Scheduled`

- `WinPrism.exe` — DELETE, SELECT

## `ScheduledReport`

- `WinPrism.exe` — DELETE, INSERT, SELECT, UPDATE

## `ScheduledReportStatus`

- `WinPrism.exe` — SELECT

## `Sequence`

- `WA_AP.dll` — SELECT
- `WACommon.dll` — SELECT
- `WPBuyBack.dll` — SELECT
- `WPUtility.dll` — SELECT

## `Sequence_Check_Info`

- `WA_AP.dll` — SELECT
- `WACommon.dll` — SELECT

## `Sequence_Type`

- `WA_AP.dll` — SELECT
- `WA_AR.dll` — SELECT
- `WA_GL.dll` — SELECT
- `WPAdmin.exe` — SELECT
- `WPUtility.dll` — SELECT

## `SerialNumberDetail`

- `ItemMnt.dll` — DELETE, SELECT, UPDATE
- `WPUtility.dll` — DELETE, SELECT, UPDATE

## `SerialNumberHeader`

- `ItemMnt.dll` — SELECT
- `WinPrism.exe` — SELECT
- `WPUtility.dll` — INSERT, SELECT

## `ShelfLocations`

- `ItemMnt.dll` — SELECT, UPDATE

## `ShipVia`

- `VendMnt.dll` — SELECT
- `WinPrism.exe` — SELECT
- `WPInv.dll` — SELECT
- `WPUtility.dll` — SELECT

## `Size`

- `WPUtility.dll` — DELETE, SELECT

## `SortHeader`

- `WPComm.dll` — DELETE, SELECT

## `State_Code`

- `WPComm.dll` — SELECT
- `WPPosCmn.dll` — SELECT
- `WPUtility.dll` — SELECT

## `Statement`

- `WA_AR.dll` — DELETE, SELECT

## `Status_Codes`

- `WA_AP.dll` — SELECT
- `WA_AR.dll` — SELECT
- `WinPrism.exe` — SELECT
- `WPBuyBack.dll` — SELECT
- `WPCredit.dll` — SELECT
- `WPInv.dll` — SELECT
- `WPUtility.dll` — SELECT

## `StockAdjustReason`

- `WPUtility.dll` — DELETE, SELECT

## `StockAdjustReason_vw`

- `ItemMnt.dll` — SELECT
- `WPUtility.dll` — SELECT

## `Stock_Adjustment_Table`

- `ItemMnt.dll` — SELECT
- `WPUtility.dll` — INSERT, SELECT

## `Stock_Ledger`

- `WPAdmin.exe` — SELECT, UPDATE

## `Stock_Ledger_Reverse`

- `WinPrism.exe` — SELECT

## `Store_Information_Table`

- `WinPrism.exe` — SELECT
- `WPPosCmn.dll` — SELECT
- `WPUtility.dll` — SELECT

## `Style_Graphics`

- `ItemMnt.dll` — SELECT

## `Style_Location_Colors`

- `ItemMnt.dll` — SELECT, UPDATE

## `Style_Location_Components`

- `WPUtility.dll` — SELECT

## `Style_Locations`

- `ItemMnt.dll` — SELECT, UPDATE
- `WPUtility.dll` — SELECT

## `Style_Template`

- `ItemMnt.dll` — SELECT

## `Styles`

- `ItemMnt.dll` — SELECT

## `Subsystem_Table`

- `VendMnt.dll` — SELECT
- `WinPrism.exe` — SELECT
- `WPAdmin.exe` — SELECT
- `WPInv.dll` — SELECT
- `WPUtility.dll` — SELECT

## `SystemParameters`

- `ItemMnt.dll` — SELECT
- `WA_AP.dll` — SELECT
- `WA_AR.dll` — SELECT
- `WA_GL.dll` — SELECT
- `WinPrism.exe` — SELECT, UPDATE
- `WPAdmin.exe` — SELECT, UPDATE
- `WPBuyBack.dll` — SELECT
- `WPComm.dll` — SELECT, UPDATE
- `WPUtility.dll` — SELECT

## `SystemParameters_Groups`

- `WPAdmin.exe` — SELECT

## `Systemparameters`

- `WinPrism.exe` — SELECT

## `TagType`

- `ItemMnt.dll` — SELECT
- `WPAdmin.exe` — SELECT, UPDATE
- `WPUtility.dll` — SELECT

## `TagTypePrinter`

- `ItemMnt.dll` — SELECT
- `WinPrism.exe` — SELECT
- `WPUtility.dll` — SELECT

## `TaxType`

- `ItemMnt.dll` — SELECT
- `WPAdmin.exe` — SELECT

## `Tax_Code_Group`

- `WinPrism.exe` — SELECT
- `WPPosCmn.dll` — DELETE, SELECT

## `Tax_Code_Grouping`

- `WinPrism.exe` — SELECT
- `WPPosCmn.dll` — DELETE, SELECT, UPDATE

## `Tax_Codes`

- `WinPrism.exe` — SELECT
- `WPPosCmn.dll` — DELETE, SELECT

## `Tax_Codes_Location`

- `WinPrism.exe` — SELECT
- `WPPosCmn.dll` — DELETE, INSERT, SELECT

## `Tax_Jurisdiction`

- `WPPosCmn.dll` — DELETE, INSERT, SELECT

## `Tax_Shift_Profiles`

- `WPPosCmn.dll` — DELETE, SELECT

## `Tax_Tables`

- `WPPosCmn.dll` — DELETE, SELECT

## `Tax_Type`

- `WPPosCmn.dll` — SELECT

## `Template`

- `WinPrism.exe` — DELETE, SELECT

## `Tender_Auth_Types`

- `WinPrism.exe` — SELECT
- `WPComm.dll` — SELECT
- `WPPosCmn.dll` — SELECT
- `WPTender.dll` — SELECT

## `Tender_Codes`

- `WinPrism.exe` — SELECT
- `WPComm.dll` — SELECT
- `WPPosCmn.dll` — DELETE, SELECT
- `WPUtility.dll` — SELECT

## `Tender_Codes_BIN_Rng`

- `WPPosCmn.dll` — DELETE, SELECT

## `Tender_Codes_Location`

- `WinPrism.exe` — SELECT
- `WPBuyBack.dll` — SELECT
- `WPComm.dll` — SELECT
- `WPPosCmn.dll` — DELETE, SELECT
- `WPTender.dll` — SELECT

## `Tender_Codes_Multi`

- `WPPosCmn.dll` — DELETE, INSERT, SELECT

## `Tender_Queues`

- `WPComm.dll` — SELECT
- `WPPosCmn.dll` — SELECT

## `Tender_codes`

- `WA_AR.dll` — SELECT

## `TermCondition`

- `WPUtility.dll` — SELECT, UPDATE

## `TextStatus`

- `ItemMnt.dll` — SELECT

## `TextStatus_ONIX`

- `ItemMnt.dll` — SELECT

## `Textbook`

- `ItemMnt.dll` — DELETE, SELECT
- `WinPrism.exe` — SELECT
- `WPBuyBack.dll` — SELECT
- `WPComm.dll` — SELECT
- `WPUtility.dll` — SELECT, UPDATE

## `TradeStatus`

- `ItemMnt.dll` — SELECT

## `TradeStatus_ONIX`

- `ItemMnt.dll` — SELECT

## `Tradebook`

- `ItemMnt.dll` — DELETE, SELECT
- `WPBuyBack.dll` — SELECT
- `WPUtility.dll` — SELECT, UPDATE

## `Transaction_AVSText`

- `WPComm.dll` — SELECT

## `Transaction_Address`

- `WinPrism.exe` — SELECT, UPDATE
- `WPComm.dll` — SELECT

## `Transaction_Detail`

- `WinPrism.exe` — DELETE, SELECT, UPDATE
- `WPComm.dll` — SELECT, UPDATE
- `WPUtility.dll` — SELECT

## `Transaction_Detail_Tender`

- `WPComm.dll` — SELECT

## `Transaction_Header`

- `WA_AR.dll` — SELECT
- `WinPrism.exe` — SELECT, UPDATE
- `WPComm.dll` — SELECT, UPDATE
- `WPPosCmn.dll` — SELECT
- `WPTender.dll` — SELECT
- `WPUtility.dll` — SELECT

## `Transaction_Signature`

- `WA_AR.dll` — SELECT
- `WPComm.dll` — SELECT

## `Transaction_Tax`

- `WPComm.dll` — DELETE, SELECT

## `Transaction_Tax_Detail`

- `WPComm.dll` — DELETE, SELECT

## `Transaction_Tender`

- `WA_AR.dll` — SELECT
- `WinPrism.exe` — DELETE, SELECT, UPDATE
- `WPComm.dll` — SELECT
- `WPUtility.dll` — SELECT

## `VERBA_Import`

- `ItemMnt.dll` — DELETE, INSERT, SELECT

## `VERBA_Price_Change`

- `ItemMnt.dll` — DELETE, SELECT

## `VERBA_Price_Change_History`

- `ItemMnt.dll` — SELECT

## `VERBA_Price_Change_View`

- `ItemMnt.dll` — SELECT, UPDATE

## `VendorAddress`

- `WinPrism.exe` — SELECT

## `VendorAddressGroups`

- `VendMnt.dll` — SELECT
- `WPAdmin.exe` — SELECT
- `WPUtility.dll` — SELECT

## `VendorDiscountCodes`

- `WPUtility.dll` — SELECT, UPDATE

## `VendorISBN`

- `WPUtility.dll` — SELECT

## `VendorLocation`

- `VendMnt.dll` — SELECT

## `VendorMaster`

- `ItemMnt.dll` — SELECT
- `VendMnt.dll` — SELECT
- `WA_AP.dll` — SELECT
- `WinPrism.exe` — SELECT
- `WPBuyBack.dll` — SELECT
- `WPInv.dll` — SELECT
- `WPUtility.dll` — SELECT

## `VendorOrderingMethod`

- `VendMnt.dll` — SELECT
- `WinPrism.exe` — SELECT
- `WPUtility.dll` — SELECT

## `VendorParameters`

- `WA_AP.dll` — SELECT
- `WinPrism.exe` — SELECT
- `WPCredit.dll` — SELECT
- `WPInv.dll` — SELECT, UPDATE
- `WPUtility.dll` — SELECT

## `VendorPubnetCode`

- `VendMnt.dll` — SELECT

## `VendorTypes`

- `VendMnt.dll` — SELECT

## `Verba_Price_Change_View`

- `ItemMnt.dll` — SELECT, UPDATE

## `WHL_Detail`

- `WinPrism.exe` — SELECT

## `WantListDetail`

- `WinPrism.exe` — DELETE, SELECT

## `WantListHeader`

- `WinPrism.exe` — SELECT

## `WantListLocationTerm`

- `WinPrism.exe` — SELECT

## `WantListLocationTerm_vw`

- `WinPrism.exe` — SELECT

## `WantListVendor`

- `WinPrism.exe` — SELECT

## `WantListVendorTerm`

- `WinPrism.exe` — SELECT

## `WantList_Location`

- `WinPrism.exe` — DELETE, SELECT

## `WantlistHeader`

- `WinPrism.exe` — SELECT

## `WantlistVendor`

- `WinPrism.exe` — SELECT

## `WantlistVendorTerm`

- `WinPrism.exe` — SELECT

## `Warranty`

- `ItemMnt.dll` — SELECT
- `WinPrism.exe` — SELECT

## `WebOrderDepositProcessLogDetail`

- `WinPrism.exe` — SELECT, UPDATE

## `Web_Routing`

- `WPAdmin.exe` — SELECT

## `Web_Routing_Ex`

- `WPComm.dll` — SELECT

## `X12_ASN_Carton`

- `WinPrism.exe` — SELECT

## `X12_ASN_Item`

- `WinPrism.exe` — SELECT

## `X12_ASN_PO`

- `WinPrism.exe` — SELECT

## `XDOC_ExchangeDetail`

- `WinPrism.exe` — SELECT

## `XDoc_Exceptions`

- `WinPrism.exe` — INSERT, SELECT

## `XDoc_Header`

- `WinPrism.exe` — SELECT, UPDATE

## `XDoc_ItemInfo`

- `WinPrism.exe` — SELECT

## `XDoc_Log`

- `WinPrism.exe` — INSERT, SELECT

## `XDoc_Note`

- `WinPrism.exe` — DELETE, INSERT, SELECT

## `XDoc_Source`

- `WinPrism.exe` — SELECT

## `XDoc_Target`

- `WinPrism.exe` — SELECT, UPDATE

## `XDoc_VendorPreferences`

- `WinPrism.exe` — SELECT

## `acct_ARInvoice_Pymt`

- `WA_AR.dll` — DELETE, SELECT

## `acct_Memb_Tier_detail`

- `WA_AR.dll` — DELETE, SELECT

## `acct_Pay_Batch_Header`

- `WA_AP.dll` — SELECT

## `acct_agency`

- `WA_AR.dll` — SELECT

## `acct_agency_customer`

- `WA_AR.dll` — SELECT

## `acct_agency_group`

- `WA_AR.dll` — SELECT

## `acct_agency_type`

- `WA_AR.dll` — SELECT

## `acct_apply`

- `WA_AR.dll` — SELECT
- `WPUtility.dll` — SELECT

## `acct_arinvoice_giftcert`

- `WA_AR.dll` — SELECT

## `acct_arinvoice_header`

- `WA_AR.dll` — SELECT

## `acct_balance_type`

- `WA_AR.dll` — SELECT

## `acct_check_header`

- `WA_AP.dll` — SELECT

## `acct_memb_account`

- `WA_AR.dll` — SELECT

## `acct_memb_acct_cust`

- `WA_AR.dll` — SELECT

## `acct_statement_codes`

- `WA_AR.dll` — SELECT

## `all`

- `WPAdmin.exe` — DELETE, SELECT

## `binding`

- `WPUtility.dll` — SELECT

## `bip_temp`

- `WinPrism.exe` — INSERT, SELECT, UPDATE
- `WPUtility.dll` — DELETE, INSERT, SELECT, UPDATE

## `bundle_detailItem`

- `WPBuyBack.dll` — SELECT

## `buyback_detail`

- `WPBuyBack.dll` — SELECT

## `buyback_header`

- `WPBuyBack.dll` — SELECT

## `buyback_pricetagqueue`

- `WPBuyBack.dll` — DELETE, SELECT
- `WPUtility.dll` — DELETE, SELECT, UPDATE

## `buyback_pricetagqueueuser`

- `WPBuyBack.dll` — DELETE, SELECT

## `buyback_session`

- `WPBuyBack.dll` — DELETE, SELECT

## `buyback_workstations`

- `WPBuyBack.dll` — DELETE, SELECT

## `buyers_guide_adopted`

- `WPBuyBack.dll` — SELECT

## `buyers_guide_table`

- `WinPrism.exe` — SELECT

## `buyers_guide_vendors`

- `WPInv.dll` — SELECT

## `catalog_sales_Header`

- `WPUtility.dll` — SELECT

## `catalog_sales_tender`

- `WPUtility.dll` — SELECT

## `cr_course`

- `WinPrism.exe` — DELETE, SELECT

## `cr_detail`

- `WinPrism.exe` — SELECT

## `cr_header`

- `WinPrism.exe` — SELECT

## `cr_locations`

- `WinPrism.exe` — SELECT

## `cr_term`

- `WinPrism.exe` — SELECT

## `current`

- `ItemMnt.dll` — DELETE, SELECT
- `WA_AP.dll` — DELETE, SELECT
- `WA_AR.dll` — DELETE, SELECT
- `WA_GL.dll` — DELETE, SELECT
- `WinPrism.exe` — DELETE, SELECT

## `custom_Reports`

- `WPAdmin.exe` — SELECT, UPDATE

## `custom_reports`

- `WPAdmin.exe` — SELECT, UPDATE

## `custom_reports_log`

- `WPAdmin.exe` — INSERT, SELECT

## `customer_address`

- `WPUtility.dll` — SELECT

## `customer_location`

- `WPUtility.dll` — DELETE, SELECT

## `customer_table`

- `WA_AR.dll` — SELECT
- `WPUtility.dll` — SELECT

## `dbo`

- `WinPrism.exe` — SELECT
- `WPBuyBack.dll` — SELECT
- `WPPosCmn.dll` — DELETE, INSERT, SELECT

## `g3_reportparam_control_types`

- `WPAdmin.exe` — SELECT

## `g3_reportparam_param_types`

- `WPAdmin.exe` — SELECT

## `inventory`

- `ItemMnt.dll` — SELECT, UPDATE
- `WinPrism.exe` — SELECT
- `WPPosCmn.dll` — SELECT

## `invoice_detail`

- `WPInv.dll` — SELECT

## `invwks_dcc`

- `WinPrism.exe` — SELECT

## `item`

- `ItemMnt.dll` — SELECT, UPDATE
- `WinPrism.exe` — SELECT
- `WPBuyBack.dll` — SELECT

## `itemmaster`

- `WPUtility.dll` — SELECT, UPDATE

## `location`

- `ItemMnt.dll` — SELECT
- `WinPrism.exe` — SELECT
- `WPAdmin.exe` — SELECT
- `WPPosCmn.dll` — SELECT

## `mo_discount_codes`

- `WPAdmin.exe` — DELETE, SELECT
- `WPUtility.dll` — SELECT

## `mo_discount_codes_method`

- `WPAdmin.exe` — SELECT

## `mo_discount_codes_type`

- `WPAdmin.exe` — SELECT

## `mo_shipping_codes_location`

- `WPAdmin.exe` — SELECT

## `mr_detail`

- `WinPrism.exe` — SELECT

## `mr_header`

- `WinPrism.exe` — SELECT

## `mr_location`

- `WinPrism.exe` — SELECT

## `mt_costtypes`

- `WinPrism.exe` — SELECT

## `mt_location`

- `WinPrism.exe` — DELETE, SELECT

## `order_decisions`

- `WinPrism.exe` — SELECT, UPDATE
- `WPBuyBack.dll` — SELECT

## `outgoingmessages`

- `WPUtility.dll` — SELECT

## `packagedetail`

- `ItemMnt.dll` — DELETE, SELECT
- `WinPrism.exe` — SELECT

## `packageheader`

- `ItemMnt.dll` — SELECT
- `WinPrism.exe` — SELECT

## `packagestockadjustcode`

- `WPUtility.dll` — SELECT

## `po_detail`

- `WinPrism.exe` — SELECT

## `po_header`

- `WinPrism.exe` — SELECT

## `po_location`

- `WinPrism.exe` — SELECT

## `pos_device`

- `WPUtility.dll` — SELECT

## `pos_fee_codes`

- `WinPrism.exe` — SELECT

## `pos_setup`

- `WA_AR.dll` — SELECT
- `WPAdmin.exe` — SELECT
- `WPPosCmn.dll` — SELECT

## `price_change_table`

- `ItemMnt.dll` — DELETE, SELECT

## `prism`

- `ItemMnt.dll` — SELECT
- `WinPrism.exe` — SELECT
- `WPAdmin.exe` — DELETE, INSERT, SELECT
- `WPPosCmn.dll` — SELECT

## `prism_security`

- `ItemMnt.dll` — SELECT
- `VendMnt.dll` — SELECT
- `WA_AR.dll` — SELECT
- `WinPrism.exe` — SELECT
- `WPAdmin.exe` — DELETE, SELECT, UPDATE
- `WPComm.dll` — DELETE, SELECT, UPDATE
- `WPInv.dll` — SELECT
- `WPUtility.dll` — DELETE, SELECT

## `problem_notifications_detail`

- `WinPrism.exe` — INSERT, SELECT, UPDATE

## `problem_notifications_header`

- `WinPrism.exe` — DELETE, INSERT, SELECT

## `pubnet_code`

- `VendMnt.dll` — SELECT

## `rental_detail`

- `WinPrism.exe` — SELECT

## `rental_history`

- `WPUtility.dll` — SELECT

## `reportsortoptions`

- `WinPrism.exe` — SELECT

## `royalty`

- `WPAdmin.exe` — SELECT, UPDATE

## `salestable`

- `WinPrism.exe` — SELECT, UPDATE

## `selected`

- `WA_AR.dll` — DELETE, SELECT
- `WA_GL.dll` — DELETE, SELECT
- `WinPrism.exe` — DELETE, SELECT
- `WPAdmin.exe` — DELETE, SELECT
- `WPUtility.dll` — DELETE, SELECT

## `sequence`

- `WA_AP.dll` — SELECT
- `WA_AR.dll` — SELECT
- `WPPosCmn.dll` — SELECT

## `sequence_check_info`

- `WA_AP.dll` — DELETE, SELECT

## `serialnumberheader`

- `WinPrism.exe` — SELECT

## `status_codes`

- `WinPrism.exe` — SELECT
- `WPCredit.dll` — SELECT

## `subsystem_table`

- `WinPrism.exe` — SELECT

## `sys`

- `WinPrism.exe` — SELECT

## `sysobjects`

- `WPUtility.dll` — SELECT

## `systemlog`

- `WPUtility.dll` — DELETE, SELECT

## `systemparameters`

- `WA_AR.dll` — SELECT
- `WinPrism.exe` — SELECT
- `WPAdmin.exe` — SELECT
- `WPComm.dll` — SELECT

## `tempsalestable`

- `WinPrism.exe` — DELETE, SELECT

## `tender_auth_types`

- `WPPosCmn.dll` — SELECT

## `tender_codes_location`

- `WA_AR.dll` — SELECT

## `textbook`

- `ItemMnt.dll` — SELECT
- `WPBuyBack.dll` — SELECT

## `the`

- `WinPrism.exe` — DELETE, SELECT
- `WPAdmin.exe` — SELECT
- `WPUtility.dll` — DELETE, SELECT, UPDATE

## `these`

- `WA_AR.dll` — DELETE, SELECT

## `this`

- `WA_AR.dll` — DELETE, SELECT
- `WA_GL.dll` — SELECT
- `WinPrism.exe` — DELETE, SELECT
- `WPUtility.dll` — DELETE, SELECT

## `transaction_detail`

- `WinPrism.exe` — SELECT
- `WPComm.dll` — SELECT
- `WPUtility.dll` — SELECT

## `transaction_header`

- `WPComm.dll` — SELECT
- `WPUtility.dll` — SELECT

## `transaction_tender`

- `WA_AR.dll` — SELECT

## `user`

- `WPAdmin.exe` — DELETE, SELECT

## `vendoraddress`

- `WPUtility.dll` — SELECT

## `vendorisbn`

- `WPUtility.dll` — SELECT

## `vendormaster`

- `VendMnt.dll` — DELETE, SELECT
- `WinPrism.exe` — SELECT
- `WPUtility.dll` — SELECT

## `verba_price_change`

- `ItemMnt.dll` — DELETE, SELECT

## `wantlistheader`

- `WinPrism.exe` — DELETE, SELECT

## `warranty`

- `ItemMnt.dll` — DELETE, SELECT

## `web_routing`

- `WPAdmin.exe` — SELECT

## `whl_detail`

- `WinPrism.exe` — DELETE, SELECT

## `wlvt`

- `WinPrism.exe` — SELECT, UPDATE

## `x12_ASN_Item`

- `WinPrism.exe` — SELECT

## `x12_ASN_PO`

- `WinPrism.exe` — SELECT

## `x12_ASN_carton`

- `WinPrism.exe` — SELECT

## `xdoc_filltype`

- `WinPrism.exe` — SELECT

## `xdoc_note`

- `WinPrism.exe` — SELECT

## `xdoc_ordertype`

- `WinPrism.exe` — SELECT

## `xdoc_target`

- `WinPrism.exe` — SELECT

## `xdoc_translator`

- `WinPrism.exe` — SELECT

## `xdoc_type`

- `WinPrism.exe` — SELECT

