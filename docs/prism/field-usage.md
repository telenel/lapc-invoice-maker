# Prism field-usage snapshot

Generated: 2026-04-20T03:42:06.834Z

Scope: Pierce locations (LocationID IN 2, 3, 4). PBO excluded. Textbook "active" = sold at any Pierce location within the last 18 months.

Each table is sorted by % populated. Populated rules per column kind:

- `str` — non-null AND trimmed length > 0
- `id`  — > 0 (non-null)
- `money` / `decimal` — non-null AND > 0
- `int` — non-null AND > 0 (or `<> 0` for stock-on-hand / reservations)
- `flag` — set to 1
- `date` — non-null

## gm_item_fields (n=33,340)

| % | Column | Populated | Total |
|---:|---|---:|---:|
| 100.0% | `Item.VendorID` (id) | 33,340 | 33,340 |
| 100.0% | `Item.DCCID` (id) | 33,340 | 33,340 |
| 100.0% | `Item.ItemTaxTypeID` (id) | 33,340 | 33,340 |
| 69.5% | `Item.BarCode` (str) | 23,174 | 33,340 |
| 6.9% | `Item.txComment` (str) | 2,308 | 33,340 |
| 0.2% | `Item.fDiscontinue` (flag) | 52 | 33,340 |
| 0.0% | `Item.StyleID` (id) | 14 | 33,340 |
| 0.0% | `Item.fPerishable` (flag) | 8 | 33,340 |
| 0.0% | `Item.fIDRequired` (flag) | 1 | 33,340 |
| 0.0% | `Item.UsedDCCID` (id) | 0 | 33,340 |
| 0.0% | `Item.TypeID_isUsed` (flag) | 0 | 33,340 |
| 0.0% | `Item.MinOrderQty` (int) | 0 | 33,340 |
| 0.0% | `Item.fListPriceFlag` (flag) | 0 | 33,340 |
| 0.0% | `Item.DiscCodeID` (id) | 0 | 33,340 |
| 0.0% | `Item.Weight` (decimal) | 0 | 33,340 |
| 0.0% | `Item.ItemSeasonCodeID` (id) | 0 | 33,340 |

## gm_gm_fields (n=33,340)

| % | Column | Populated | Total |
|---:|---|---:|---:|
| 100.0% | `GeneralMerchandise.PackageType` (str) | 33,340 | 33,340 |
| 100.0% | `GeneralMerchandise.Description` (str) | 33,336 | 33,340 |
| 70.9% | `GeneralMerchandise.CatalogNumber` (str) | 23,653 | 33,340 |
| 29.1% | `GeneralMerchandise.SizeID` (id) | 9,692 | 33,340 |
| 29.0% | `GeneralMerchandise.Color` (id) | 9,675 | 33,340 |
| 15.0% | `GeneralMerchandise.UnitsPerPack_gt1` (int) | 5,006 | 33,340 |
| 6.1% | `GeneralMerchandise.MfgID_distinctFromVendor` (id) | 2,024 | 33,340 |
| 5.5% | `GeneralMerchandise.Type` (str) | 1,849 | 33,340 |
| 0.0% | `GeneralMerchandise.OrderIncrement_gt1` (int) | 11 | 33,340 |
| 0.0% | `GeneralMerchandise.ImageURL` (str) | 6 | 33,340 |
| 0.0% | `GeneralMerchandise.UseScaleInterface` (flag) | 3 | 33,340 |
| 0.0% | `GeneralMerchandise.Weight` (decimal) | 1 | 33,340 |
| 0.0% | `GeneralMerchandise.AlternateVendorID` (id) | 0 | 33,340 |
| 0.0% | `GeneralMerchandise.Size` (str) | 0 | 33,340 |
| 0.0% | `GeneralMerchandise.Tare` (decimal) | 0 | 33,340 |

## gm_inventory_fields (n=49,940)

| % | Column | Populated | Total |
|---:|---|---:|---:|
| 100.0% | `Inventory.TagTypeID` (id) | 49,940 | 49,940 |
| 100.0% | `Inventory.LastSaleDate` (date) | 49,940 | 49,940 |
| 99.9% | `Inventory.TaxTypeID` (id) | 49,868 | 49,940 |
| 98.9% | `Inventory.StatusCodeID` (id) | 49,400 | 49,940 |
| 98.4% | `Inventory.Retail` (money) | 49,140 | 49,940 |
| 96.7% | `Inventory.Cost` (money) | 48,277 | 49,940 |
| 95.3% | `Inventory.fInvListPriceFlag` (flag) | 47,586 | 49,940 |
| 39.6% | `Inventory.ExpectedCost` (money) | 19,772 | 49,940 |
| 39.3% | `Inventory.EstSales_nonzero` (int) | 19,609 | 49,940 |
| 15.7% | `Inventory.StockOnHand_nonzero` (int) | 7,845 | 49,940 |
| 4.9% | `Inventory.fTXWantListFlag` (flag) | 2,426 | 49,940 |
| 4.9% | `Inventory.fTXBuybackListFlag` (flag) | 2,426 | 49,940 |
| 0.0% | `Inventory.MinimumStock` (int) | 13 | 49,940 |
| 0.0% | `Inventory.MaximumStock` (int) | 11 | 49,940 |
| 0.0% | `Inventory.AutoOrderQty` (int) | 3 | 49,940 |
| 0.0% | `Inventory.MinOrderQty` (int) | 3 | 49,940 |
| 0.0% | `Inventory.fNoReturns` (flag) | 2 | 49,940 |
| 0.0% | `Inventory.RentalQty` (int) | 1 | 49,940 |
| 0.0% | `Inventory.fRentOnly` (flag) | 1 | 49,940 |
| 0.0% | `Inventory.DiscCodeID` (id) | 0 | 49,940 |
| 0.0% | `Inventory.ReservedQty` (int) | 0 | 49,940 |
| 0.0% | `Inventory.RoyaltyCost` (money) | 0 | 49,940 |
| 0.0% | `Inventory.MinRoyaltyCost` (money) | 0 | 49,940 |
| 0.0% | `Inventory.EstSalesLocked` (flag) | 0 | 49,940 |
| 0.0% | `Inventory.TextComment` (str) | 0 | 49,940 |

## tx_item_fields (n=572)

| % | Column | Populated | Total |
|---:|---|---:|---:|
| 100.0% | `Item.VendorID` (id) | 572 | 572 |
| 100.0% | `Item.DCCID` (id) | 572 | 572 |
| 100.0% | `Item.ItemTaxTypeID` (id) | 572 | 572 |
| 94.1% | `Item.BarCode` (str) | 538 | 572 |
| 20.8% | `Item.txComment` (str) | 119 | 572 |
| 15.2% | `Item.fListPriceFlag` (flag) | 87 | 572 |
| 0.7% | `Item.fDiscontinue` (flag) | 4 | 572 |
| 0.0% | `Item.UsedDCCID` (id) | 0 | 572 |
| 0.0% | `Item.TypeID_isUsed` (flag) | 0 | 572 |
| 0.0% | `Item.MinOrderQty` (int) | 0 | 572 |
| 0.0% | `Item.DiscCodeID` (id) | 0 | 572 |
| 0.0% | `Item.Weight` (decimal) | 0 | 572 |
| 0.0% | `Item.StyleID` (id) | 0 | 572 |
| 0.0% | `Item.ItemSeasonCodeID` (id) | 0 | 572 |
| 0.0% | `Item.fPerishable` (flag) | 0 | 572 |
| 0.0% | `Item.fIDRequired` (flag) | 0 | 572 |

## tx_textbook_fields (n=572)

| % | Column | Populated | Total |
|---:|---|---:|---:|
| 100.0% | `Textbook.UsedSKU` (id) | 572 | 572 |
| 100.0% | `Textbook.StatusDate` (date) | 572 | 572 |
| 100.0% | `Textbook.Author` (str) | 572 | 572 |
| 100.0% | `Textbook.Title` (str) | 572 | 572 |
| 100.0% | `Textbook.Bookkey` (str) | 572 | 572 |
| 91.8% | `Textbook.ISBN` (str) | 525 | 572 |
| 82.9% | `Textbook.BindingID` (id) | 474 | 572 |
| 65.4% | `Textbook.Edition` (str) | 374 | 572 |
| 54.9% | `Textbook.Copyright` (str) | 314 | 572 |
| 39.2% | `Textbook.Imprint` (str) | 224 | 572 |
| 11.0% | `Textbook.TextStatusID` (id) | 63 | 572 |
| 0.3% | `Textbook.ImageURL` (str) | 2 | 572 |
| 0.2% | `Textbook.Weight` (decimal) | 1 | 572 |
| 0.0% | `Textbook.Type` (str) | 0 | 572 |

## tx_inventory_fields (n=609)

| % | Column | Populated | Total |
|---:|---|---:|---:|
| 100.0% | `Inventory.TaxTypeID` (id) | 609 | 609 |
| 100.0% | `Inventory.TagTypeID` (id) | 609 | 609 |
| 100.0% | `Inventory.StatusCodeID` (id) | 609 | 609 |
| 100.0% | `Inventory.LastSaleDate` (date) | 609 | 609 |
| 98.9% | `Inventory.Retail` (money) | 602 | 609 |
| 98.4% | `Inventory.Cost` (money) | 599 | 609 |
| 84.2% | `Inventory.EstSales_nonzero` (int) | 513 | 609 |
| 81.9% | `Inventory.ExpectedCost` (money) | 499 | 609 |
| 81.3% | `Inventory.fInvListPriceFlag` (flag) | 495 | 609 |
| 76.2% | `Inventory.fTXWantListFlag` (flag) | 464 | 609 |
| 75.4% | `Inventory.fTXBuybackListFlag` (flag) | 459 | 609 |
| 35.6% | `Inventory.StockOnHand_nonzero` (int) | 217 | 609 |
| 18.1% | `Inventory.fNoReturns` (flag) | 110 | 609 |
| 0.8% | `Inventory.RentalQty` (int) | 5 | 609 |
| 0.2% | `Inventory.ReservedQty` (int) | 1 | 609 |
| 0.0% | `Inventory.MaximumStock` (int) | 0 | 609 |
| 0.0% | `Inventory.MinimumStock` (int) | 0 | 609 |
| 0.0% | `Inventory.AutoOrderQty` (int) | 0 | 609 |
| 0.0% | `Inventory.MinOrderQty` (int) | 0 | 609 |
| 0.0% | `Inventory.DiscCodeID` (id) | 0 | 609 |
| 0.0% | `Inventory.RoyaltyCost` (money) | 0 | 609 |
| 0.0% | `Inventory.MinRoyaltyCost` (money) | 0 | 609 |
| 0.0% | `Inventory.EstSalesLocked` (flag) | 0 | 609 |
| 0.0% | `Inventory.fRentOnly` (flag) | 0 | 609 |
| 0.0% | `Inventory.TextComment` (str) | 0 | 609 |
