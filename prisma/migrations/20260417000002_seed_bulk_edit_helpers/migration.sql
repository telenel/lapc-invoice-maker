-- Seed system smart-helper saved searches. is_system = true makes them
-- read-only and visible to every user.
INSERT INTO saved_searches (id, created_at, updated_at, owner_user_id, name, filter, is_system)
VALUES
  (gen_random_uuid(), now(), now(), NULL, 'All textbooks',
   '{"itemType":"textbook"}'::jsonb, true),
  (gen_random_uuid(), now(), now(), NULL, 'Items without barcode',
   '{"hasBarcode":false}'::jsonb, true),
  (gen_random_uuid(), now(), now(), NULL, 'Items from vendor 21 (PENS ETC)',
   '{"vendorId":21}'::jsonb, true),
  (gen_random_uuid(), now(), now(), NULL, 'General Merchandise — under $5',
   '{"itemType":"general_merchandise","maxRetail":5}'::jsonb, true)
ON CONFLICT DO NOTHING;
