-- Fix: status_code_id and tax_type_override_id were declared SMALLINT but
-- Prism's InventoryStatusCodes.InvStatusCodeID and Inventory.TaxTypeID can
-- hold 32-bit integer values (observed: StatusCodeID = 1246576928 in live
-- Prism data). Widen both columns to INTEGER so the sync does not overflow.
ALTER TABLE product_inventory
  ALTER COLUMN status_code_id TYPE INTEGER,
  ALTER COLUMN tax_type_override_id TYPE INTEGER;
