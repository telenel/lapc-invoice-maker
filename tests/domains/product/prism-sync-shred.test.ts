import { describe, expect, it } from "vitest";
import type { PrismItemRow, PrismInventoryRow } from "@/domains/product/prism-sync";
import { shredRecordset } from "@/domains/product/prism-sync";

describe("Prism sync row types", () => {
  it("PrismItemRow carries only global (per-SKU) fields", () => {
    const row: PrismItemRow = {
      sku: 123,
      description: "Test",
      title: null,
      author: null,
      isbn: null,
      edition: null,
      binding_id: null,
      binding_label: null,
      imprint: null,
      copyright: null,
      usedSku: null,
      textStatusId: null,
      statusDate: null,
      typeTextbook: null,
      bookKey: null,
      barcode: null,
      vendorId: 100,
      altVendorId: null,
      mfgId: null,
      dccId: 1010,
      usedDccId: null,
      itemTaxTypeId: 4,
      itemTaxTypeLabel: "STATE",
      itemType: "general_merchandise",
      fDiscontinue: 0,
      txComment: null,
      weight: null,
      styleId: null,
      itemSeasonCodeId: null,
      fListPriceFlag: 0,
      fPerishable: 0,
      fIdRequired: 0,
      minOrderQtyItem: null,
      typeGm: null,
      size: null,
      sizeId: null,
      catalogNumber: null,
      packageType: "EA",
      packageTypeLabel: "Each",
      unitsPerPack: null,
      orderIncrement: 1,
      imageUrl: null,
      useScaleInterface: 0,
      tare: null,
      deptNum: 10,
      classNum: 10,
      catNum: 20,
      deptName: "Drinks",
      className: "Bottled",
      catName: "Sodas",
    };
    expect(row.sku).toBe(123);
    expect(row.itemTaxTypeLabel).toBe("STATE");
  });

  it("PrismInventoryRow carries exactly one (sku, locationId) pair", () => {
    const row: PrismInventoryRow = {
      sku: 123,
      locationId: 2,
      locationAbbrev: "PIER",
      retail: 9.99,
      cost: 4.5,
      expectedCost: null,
      stockOnHand: 12,
      tagTypeId: 3,
      tagTypeLabel: "LARGE w/Price/Color",
      statusCodeId: 2,
      statusCodeLabel: "Active",
      taxTypeOverrideId: null,
      discCodeId: null,
      minStock: null,
      maxStock: null,
      autoOrderQty: null,
      minOrderQty: null,
      holdQty: null,
      reservedQty: null,
      rentalQty: null,
      estSales: null,
      estSalesLocked: 0,
      royaltyCost: null,
      minRoyaltyCost: null,
      fInvListPriceFlag: 1,
      fTxWantListFlag: 0,
      fTxBuybackListFlag: 0,
      fRentOnly: 0,
      fNoReturns: 0,
      textCommentInv: null,
      lastSaleDate: new Date("2026-04-01T00:00:00Z"),
      lastInventoryDate: null,
      createDate: null,
    };
    expect(row.locationId).toBe(2);
    expect([2, 3, 4]).toContain(row.locationId);
  });
});

describe("shredRecordset", () => {
  const rawBase = {
    SKU: 123,
    Description: "Widget",
    TypeGm: null,
    Size: null,
    SizeID: null,
    GmColor: 0,
    CatalogNumber: "WID-100",
    PackageType: "EA ",
    PackageTypeLabel: "Each                ",
    UnitsPerPack: null,
    GmWeight: null,
    ImageURL: null,
    OrderIncrement: 1,
    UseScaleInterface: 0,
    Tare: null,
    MfgID: 0,
    AltVendorID: 0,
    Title: null,
    Author: null,
    ISBN: null,
    Edition: null,
    BindingID: null,
    Imprint: null,
    Copyright: null,
    UsedSKU: null,
    TextStatusID: null,
    StatusDate: null,
    TypeTextbook: null,
    BookKey: null,
    BindingLabel: null,
    BarCode: "WID100",
    VendorID: 100,
    DCCID: 1010,
    UsedDCCID: null,
    ItemTaxTypeID: 4,
    ItemTaxTypeLabel: "STATE                                                                           ",
    TxComment: null,
    ItemWeight: null,
    StyleID: null,
    ItemSeasonCodeID: null,
    fListPriceFlag: 0,
    fPerishable: 0,
    fIDRequired: 0,
    MinOrderQtyItem: null,
    ItemType: "general_merchandise",
    fDiscontinue: 0,
    DeptNum: 10,
    ClassNum: 10,
    CatNum: 20,
    DeptName: "Drinks",
    ClassName: "Bottled",
    CatName: "Sodas",
    Retail: 2.99,
    Cost: 1.1,
    ExpectedCost: null,
    StockOnHand: 25,
    TagTypeID: 3,
    TagTypeLabel: "LARGE w/Price/Color ",
    StatusCodeID: 2,
    StatusCodeLabel: "Active ",
    TaxTypeOverrideID: 2,
    InvDiscCodeID: null,
    InvMinStock: null,
    InvMaxStock: null,
    InvAutoOrderQty: null,
    InvMinOrderQty: null,
    ReservedQty: null,
    RentalQty: null,
    EstSales: 0,
    EstSalesLocked: 0,
    RoyaltyCost: null,
    MinRoyaltyCost: null,
    fInvListPriceFlag: 1,
    fTXWantListFlag: 0,
    fTXBuybackListFlag: 0,
    fRentOnly: 0,
    fNoReturns: 0,
    TextCommentInv: null,
    LastSaleDate: new Date("2026-04-01T00:00:00Z"),
    LastInventoryDate: null,
    InvCreateDate: null,
  };

  it("returns one PrismItemRow per distinct SKU, first occurrence wins", () => {
    const recordset = [
      { ...rawBase, LocationID: 2, LocationAbbrev: "PIER" },
      { ...rawBase, LocationID: 3, LocationAbbrev: "PCOP" },
      { ...rawBase, LocationID: 4, LocationAbbrev: "PFS " },
    ];
    const { items, inventory } = shredRecordset(recordset as never);
    expect(items).toHaveLength(1);
    expect(items[0].sku).toBe(123);
    expect(items[0].itemTaxTypeLabel).toBe("STATE");
    expect(inventory).toHaveLength(3);
    expect(inventory.map((i) => i.locationId).sort()).toEqual([2, 3, 4]);
  });

  it("PBO (LocationID 5) in recordset is rejected — hard exclude", () => {
    const recordset = [
      { ...rawBase, LocationID: 5, LocationAbbrev: "PBO " },
    ];
    expect(() => shredRecordset(recordset as never)).toThrow(/LocationID 5/);
  });

  it("trims trailing whitespace on label columns", () => {
    const recordset = [{ ...rawBase, LocationID: 2, LocationAbbrev: "PIER" }];
    const { items, inventory } = shredRecordset(recordset as never);
    expect(items[0].packageTypeLabel).toBe("Each");
    expect(items[0].itemTaxTypeLabel).toBe("STATE");
    expect(inventory[0].tagTypeLabel).toBe("LARGE w/Price/Color");
    expect(inventory[0].statusCodeLabel).toBe("Active");
  });

  it("coerces epoch-zero LastSaleDate to null", () => {
    const recordset = [
      {
        ...rawBase,
        LocationID: 2,
        LocationAbbrev: "PIER",
        LastSaleDate: new Date("1970-01-01T00:00:00Z"),
      },
    ];
    const { inventory } = shredRecordset(recordset as never);
    expect(inventory[0].lastSaleDate).toBeNull();
  });
});
