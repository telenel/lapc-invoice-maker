-- Recovered from plan cache: P_Item_Add_GM
-- 2 unique statements, ordered by statement_start_offset
-- Note: gaps possible if any statements were evicted from the cache.

insert into GeneralMerchandise(Sku, MfgId, Description, Color, SizeId, CatalogNumber, PackageType, UnitsPerPack, 
			AlternateVendorId, Type, Weight, ImageURL)
		values(@Sku, @MfgId, @Description, @Color, @SizeId, @CatalogNumber, @PackageType, @UnitsPerPack, 0, '', 
				@Weight, @ImageURL)

;-- ---

insert into Item(Sku, DccId, VendorId, SubSystem, TypeId, UUID, ItemTaxTypeId, txComment, BarCode, UsedDCCID, 
			fDiscontinue, fListPriceFlag, MinOrderQty, DiscCodeId)
		values(@Sku, @DccId, @VendorId, 1, 1, @GMUID, @ItemTaxTypeId, @Comment, @BarCode, 0, 0, 0, 0, @DiscCodeId)
