import { describe, expect, it } from "vitest";
import type { PrismItemRow, PrismInventoryRow } from "@/domains/product/prism-sync";
import {
  shredRecordset,
  buildProductsUpsertPayload,
  buildProductInventoryUpsertPayload,
  computeReapSet,
} from "@/domains/product/prism-sync";

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

describe("buildProductsUpsertPayload", () => {
  const baseItem: PrismItemRow = {
    sku: 123,
    description: "Widget",
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
    barcode: "WID100",
    vendorId: 100,
    altVendorId: null,
    mfgId: null,
    dccId: 1010,
    usedDccId: null,
    itemTaxTypeId: 4,
    itemTaxTypeLabel: "STATE",
    itemType: "general_merchandise",
    fDiscontinue: 0 as 0 | 1,
    txComment: null,
    weight: null,
    styleId: null,
    itemSeasonCodeId: null,
    fListPriceFlag: 0 as 0 | 1,
    fPerishable: 0 as 0 | 1,
    fIdRequired: 0 as 0 | 1,
    minOrderQtyItem: null,
    typeGm: null,
    size: null,
    sizeId: null,
    catalogNumber: "WID-100",
    packageType: "EA",
    packageTypeLabel: "Each",
    unitsPerPack: null,
    orderIncrement: 1,
    imageUrl: null,
    useScaleInterface: 0 as 0 | 1,
    tare: null,
    deptNum: 10,
    classNum: 10,
    catNum: 20,
    deptName: "Drinks",
    className: "Bottled",
    catName: "Sodas",
  };

  const basePierInventory: PrismInventoryRow = {
    sku: 123,
    locationId: 2 as 2 | 3 | 4,
    locationAbbrev: "PIER",
    retail: 2.99,
    cost: 1.1,
    expectedCost: null,
    stockOnHand: 25,
    tagTypeId: 3,
    tagTypeLabel: "LARGE w/Price/Color",
    statusCodeId: 2,
    statusCodeLabel: "Active",
    taxTypeOverrideId: 2,
    discCodeId: null,
    minStock: null,
    maxStock: null,
    autoOrderQty: null,
    minOrderQty: null,
    holdQty: null,
    reservedQty: null,
    rentalQty: null,
    estSales: 0,
    estSalesLocked: 0 as 0 | 1,
    royaltyCost: null,
    minRoyaltyCost: null,
    fInvListPriceFlag: 1 as 0 | 1,
    fTxWantListFlag: 0 as 0 | 1,
    fTxBuybackListFlag: 0 as 0 | 1,
    fRentOnly: 0 as 0 | 1,
    fNoReturns: 0 as 0 | 1,
    textCommentInv: null,
    lastSaleDate: new Date("2026-04-01T00:00:00Z"),
    lastInventoryDate: null,
    createDate: null,
  };

  it("products payload carries global fields plus the PIER price/stock snapshot", () => {
    const payload = buildProductsUpsertPayload(baseItem, basePierInventory);
    expect(payload.sku).toBe(123);
    expect(payload.description).toBe("Widget");
    expect(payload.item_tax_type_label).toBe("STATE");
    expect(payload.binding_label).toBeNull();
    expect(payload.retail_price).toBe(2.99);
    expect(payload.cost).toBe(1.1);
    expect(payload.stock_on_hand).toBe(25);
    expect(payload.last_sale_date).toEqual(new Date("2026-04-01T00:00:00Z"));
  });

  it("products payload uses NULL compat fields when no PIER inventory row exists", () => {
    const payload = buildProductsUpsertPayload(baseItem, null);
    expect(payload.retail_price).toBeNull();
    expect(payload.cost).toBeNull();
    expect(payload.stock_on_hand).toBeNull();
    expect(payload.last_sale_date).toBeNull();
  });

  it("product_inventory payload carries all per-location fields", () => {
    const payload = buildProductInventoryUpsertPayload(basePierInventory);
    expect(payload.sku).toBe(123);
    expect(payload.location_id).toBe(2);
    expect(payload.location_abbrev).toBe("PIER");
    expect(payload.retail_price).toBe(2.99);
    expect(payload.tag_type_label).toBe("LARGE w/Price/Color");
    expect(payload.f_inv_list_price_flag).toBe(true);
    expect(payload.f_rent_only).toBe(false);
  });
});

describe("computeReapSet", () => {
  it("returns product_inventory rows that existed before but not in this run", () => {
    const existingInventory = new Set<string>([
      "1:2", "1:3", "2:2", "3:2", "3:4",
    ]);
    const seenInventory = new Set<string>([
      "1:2", "1:3", "2:2", "3:2", // 3:4 gone
    ]);
    const { inventoryToDelete, skusWithNoLocations } = computeReapSet(
      existingInventory,
      seenInventory,
    );
    expect(Array.from(inventoryToDelete).sort()).toEqual(["3:4"]);
    expect(Array.from(skusWithNoLocations)).toEqual([]);
  });

  it("flags SKUs for products reap when all locations are gone", () => {
    const existingInventory = new Set<string>(["5:2", "5:3"]);
    const seenInventory = new Set<string>();
    const { inventoryToDelete, skusWithNoLocations } = computeReapSet(
      existingInventory,
      seenInventory,
    );
    expect(Array.from(inventoryToDelete).sort()).toEqual(["5:2", "5:3"]);
    expect(Array.from(skusWithNoLocations)).toEqual([5]);
  });
});
