-- Seed 22 products-page system presets. ON CONFLICT (slug) DO UPDATE so
-- re-running the migration refreshes preset definitions without duplicates.

INSERT INTO saved_searches (
  id, created_at, updated_at, owner_user_id,
  name, filter, is_system, description, column_preferences,
  slug, preset_group, sort_order
)
VALUES
  (gen_random_uuid(), now(), now(), NULL,
   'Discontinued with stock',
   '{"discontinued":"yes","minStock":"1"}'::jsonb, true,
   'Items marked discontinued that still have stock on hand.',
   '{"visible":["stock","updated"]}'::jsonb,
   'dead-discontinued-with-stock', 'dead-weight', 10)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  filter = EXCLUDED.filter,
  description = EXCLUDED.description,
  column_preferences = EXCLUDED.column_preferences,
  preset_group = EXCLUDED.preset_group,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO saved_searches (
  id, created_at, updated_at, owner_user_id,
  name, filter, is_system, description, column_preferences,
  slug, preset_group, sort_order
)
VALUES
  (gen_random_uuid(), now(), now(), NULL,
   'Never sold',
   '{"lastSaleNever":true}'::jsonb, true,
   'Items with no recorded last-sale date at Pierce.',
   '{"visible":["stock","est_sales","updated"]}'::jsonb,
   'dead-never-sold', 'dead-weight', 20)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  filter = EXCLUDED.filter,
  description = EXCLUDED.description,
  column_preferences = EXCLUDED.column_preferences,
  preset_group = EXCLUDED.preset_group,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO saved_searches (
  id, created_at, updated_at, owner_user_id,
  name, filter, is_system, description, column_preferences,
  slug, preset_group, sort_order
)
VALUES
  (gen_random_uuid(), now(), now(), NULL,
   'No sales in 2 years',
   '{"lastSaleOlderThan":"2y"}'::jsonb, true,
   'Last sold more than 2 years ago.',
   '{"visible":["days_since_sale","stock"]}'::jsonb,
   'dead-no-sales-2y', 'dead-weight', 30)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  filter = EXCLUDED.filter,
  description = EXCLUDED.description,
  column_preferences = EXCLUDED.column_preferences,
  preset_group = EXCLUDED.preset_group,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO saved_searches (
  id, created_at, updated_at, owner_user_id,
  name, filter, is_system, description, column_preferences,
  slug, preset_group, sort_order
)
VALUES
  (gen_random_uuid(), now(), now(), NULL,
   'No sales in 5 years',
   '{"lastSaleOlderThan":"5y"}'::jsonb, true,
   'Last sold more than 5 years ago.',
   '{"visible":["days_since_sale","stock"]}'::jsonb,
   'dead-no-sales-5y', 'dead-weight', 40)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  filter = EXCLUDED.filter,
  description = EXCLUDED.description,
  column_preferences = EXCLUDED.column_preferences,
  preset_group = EXCLUDED.preset_group,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO saved_searches (
  id, created_at, updated_at, owner_user_id,
  name, filter, is_system, description, column_preferences,
  slug, preset_group, sort_order
)
VALUES
  (gen_random_uuid(), now(), now(), NULL,
   'Zero stock + never sold',
   '{"maxStock":"0","lastSaleNever":true}'::jsonb, true,
   'No stock AND never sold — strongest dead-weight signal.',
   '{"visible":["updated"]}'::jsonb,
   'dead-zero-stock-never-sold', 'dead-weight', 50)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  filter = EXCLUDED.filter,
  description = EXCLUDED.description,
  column_preferences = EXCLUDED.column_preferences,
  preset_group = EXCLUDED.preset_group,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO saved_searches (
  id, created_at, updated_at, owner_user_id,
  name, filter, is_system, description, column_preferences,
  slug, preset_group, sort_order
)
VALUES
  (gen_random_uuid(), now(), now(), NULL,
   'Discontinued',
   '{"discontinued":"yes"}'::jsonb, true,
   'All discontinued items (active or zero stock).',
   '{"visible":["stock","updated"]}'::jsonb,
   'dead-discontinued', 'dead-weight', 60)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  filter = EXCLUDED.filter,
  description = EXCLUDED.description,
  column_preferences = EXCLUDED.column_preferences,
  preset_group = EXCLUDED.preset_group,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO saved_searches (
  id, created_at, updated_at, owner_user_id,
  name, filter, is_system, description, column_preferences,
  slug, preset_group, sort_order
)
VALUES
  (gen_random_uuid(), now(), now(), NULL,
   'Sold in last 30 days',
   '{"lastSaleWithin":"30d"}'::jsonb, true,
   'Items with a sale in the trailing 30 days.',
   '{"visible":["est_sales","stock"]}'::jsonb,
   'movers-last-30d', 'movers', 10)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  filter = EXCLUDED.filter,
  description = EXCLUDED.description,
  column_preferences = EXCLUDED.column_preferences,
  preset_group = EXCLUDED.preset_group,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO saved_searches (
  id, created_at, updated_at, owner_user_id,
  name, filter, is_system, description, column_preferences,
  slug, preset_group, sort_order
)
VALUES
  (gen_random_uuid(), now(), now(), NULL,
   'Sold in last 90 days',
   '{"lastSaleWithin":"90d"}'::jsonb, true,
   'Items with a sale in the trailing 90 days.',
   '{"visible":["est_sales","stock"]}'::jsonb,
   'movers-last-90d', 'movers', 20)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  filter = EXCLUDED.filter,
  description = EXCLUDED.description,
  column_preferences = EXCLUDED.column_preferences,
  preset_group = EXCLUDED.preset_group,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO saved_searches (
  id, created_at, updated_at, owner_user_id,
  name, filter, is_system, description, column_preferences,
  slug, preset_group, sort_order
)
VALUES
  (gen_random_uuid(), now(), now(), NULL,
   'Proven sellers',
   '{"lastSaleWithin":"90d","discontinued":"no","minStock":"1"}'::jsonb, true,
   'Sold in 90 days, still active, still have stock. Weak velocity proxy until PR #2 ships real time-series data.',
   '{"visible":["est_sales","stock","margin"]}'::jsonb,
   'movers-proven-sellers', 'movers', 30)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  filter = EXCLUDED.filter,
  description = EXCLUDED.description,
  column_preferences = EXCLUDED.column_preferences,
  preset_group = EXCLUDED.preset_group,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO saved_searches (
  id, created_at, updated_at, owner_user_id,
  name, filter, is_system, description, column_preferences,
  slug, preset_group, sort_order
)
VALUES
  (gen_random_uuid(), now(), now(), NULL,
   'Missing barcode',
   '{"missingBarcode":true}'::jsonb, true,
   'Items with no barcode on file.',
   '{"visible":["updated"]}'::jsonb,
   'data-missing-barcode', 'data-quality', 10)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  filter = EXCLUDED.filter,
  description = EXCLUDED.description,
  column_preferences = EXCLUDED.column_preferences,
  preset_group = EXCLUDED.preset_group,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO saved_searches (
  id, created_at, updated_at, owner_user_id,
  name, filter, is_system, description, column_preferences,
  slug, preset_group, sort_order
)
VALUES
  (gen_random_uuid(), now(), now(), NULL,
   'Missing ISBN (textbooks)',
   '{"tab":"textbooks","missingIsbn":true}'::jsonb, true,
   'Textbooks with no ISBN.',
   '{"visible":["updated"]}'::jsonb,
   'data-missing-isbn-textbook', 'data-quality', 20)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  filter = EXCLUDED.filter,
  description = EXCLUDED.description,
  column_preferences = EXCLUDED.column_preferences,
  preset_group = EXCLUDED.preset_group,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO saved_searches (
  id, created_at, updated_at, owner_user_id,
  name, filter, is_system, description, column_preferences,
  slug, preset_group, sort_order
)
VALUES
  (gen_random_uuid(), now(), now(), NULL,
   'Missing description or title',
   '{"missingTitle":true}'::jsonb, true,
   'Textbooks without a title, or general merchandise without a description.',
   '{"visible":["updated"]}'::jsonb,
   'data-missing-title-or-description', 'data-quality', 30)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  filter = EXCLUDED.filter,
  description = EXCLUDED.description,
  column_preferences = EXCLUDED.column_preferences,
  preset_group = EXCLUDED.preset_group,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO saved_searches (
  id, created_at, updated_at, owner_user_id,
  name, filter, is_system, description, column_preferences,
  slug, preset_group, sort_order
)
VALUES
  (gen_random_uuid(), now(), now(), NULL,
   'Retail < cost',
   '{"retailBelowCost":true}'::jsonb, true,
   'Retail price lower than cost. Usually a data entry error.',
   '{"visible":["margin","updated"]}'::jsonb,
   'data-retail-below-cost', 'data-quality', 40)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  filter = EXCLUDED.filter,
  description = EXCLUDED.description,
  column_preferences = EXCLUDED.column_preferences,
  preset_group = EXCLUDED.preset_group,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO saved_searches (
  id, created_at, updated_at, owner_user_id,
  name, filter, is_system, description, column_preferences,
  slug, preset_group, sort_order
)
VALUES
  (gen_random_uuid(), now(), now(), NULL,
   'Retail or cost = 0',
   '{"zeroPrice":true}'::jsonb, true,
   'Retail or cost is exactly zero.',
   '{"visible":["updated"]}'::jsonb,
   'data-zero-price', 'data-quality', 50)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  filter = EXCLUDED.filter,
  description = EXCLUDED.description,
  column_preferences = EXCLUDED.column_preferences,
  preset_group = EXCLUDED.preset_group,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO saved_searches (
  id, created_at, updated_at, owner_user_id,
  name, filter, is_system, description, column_preferences,
  slug, preset_group, sort_order
)
VALUES
  (gen_random_uuid(), now(), now(), NULL,
   'GM under $5',
   '{"tab":"merchandise","maxPrice":"5"}'::jsonb, true,
   'General merchandise priced under $5.',
   '{"visible":["margin","est_sales"]}'::jsonb,
   'pricing-gm-under-5', 'pricing', 10)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  filter = EXCLUDED.filter,
  description = EXCLUDED.description,
  column_preferences = EXCLUDED.column_preferences,
  preset_group = EXCLUDED.preset_group,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO saved_searches (
  id, created_at, updated_at, owner_user_id,
  name, filter, is_system, description, column_preferences,
  slug, preset_group, sort_order
)
VALUES
  (gen_random_uuid(), now(), now(), NULL,
   'GM over $50',
   '{"tab":"merchandise","minPrice":"50"}'::jsonb, true,
   'General merchandise priced over $50.',
   '{"visible":["margin","est_sales"]}'::jsonb,
   'pricing-gm-over-50', 'pricing', 20)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  filter = EXCLUDED.filter,
  description = EXCLUDED.description,
  column_preferences = EXCLUDED.column_preferences,
  preset_group = EXCLUDED.preset_group,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO saved_searches (
  id, created_at, updated_at, owner_user_id,
  name, filter, is_system, description, column_preferences,
  slug, preset_group, sort_order
)
VALUES
  (gen_random_uuid(), now(), now(), NULL,
   'Textbooks over $100',
   '{"tab":"textbooks","minPrice":"100"}'::jsonb, true,
   'Textbooks priced over $100.',
   '{"visible":["margin","est_sales"]}'::jsonb,
   'pricing-textbooks-over-100', 'pricing', 30)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  filter = EXCLUDED.filter,
  description = EXCLUDED.description,
  column_preferences = EXCLUDED.column_preferences,
  preset_group = EXCLUDED.preset_group,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO saved_searches (
  id, created_at, updated_at, owner_user_id,
  name, filter, is_system, description, column_preferences,
  slug, preset_group, sort_order
)
VALUES
  (gen_random_uuid(), now(), now(), NULL,
   'High margin',
   '{"minMargin":"0.4"}'::jsonb, true,
   'Margin above 40%.',
   '{"visible":["margin","est_sales"]}'::jsonb,
   'pricing-high-margin', 'pricing', 40)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  filter = EXCLUDED.filter,
  description = EXCLUDED.description,
  column_preferences = EXCLUDED.column_preferences,
  preset_group = EXCLUDED.preset_group,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO saved_searches (
  id, created_at, updated_at, owner_user_id,
  name, filter, is_system, description, column_preferences,
  slug, preset_group, sort_order
)
VALUES
  (gen_random_uuid(), now(), now(), NULL,
   'Thin margin',
   '{"maxMargin":"0.1"}'::jsonb, true,
   'Margin below 10%.',
   '{"visible":["margin","est_sales"]}'::jsonb,
   'pricing-thin-margin', 'pricing', 50)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  filter = EXCLUDED.filter,
  description = EXCLUDED.description,
  column_preferences = EXCLUDED.column_preferences,
  preset_group = EXCLUDED.preset_group,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO saved_searches (
  id, created_at, updated_at, owner_user_id,
  name, filter, is_system, description, column_preferences,
  slug, preset_group, sort_order
)
VALUES
  (gen_random_uuid(), now(), now(), NULL,
   'Edited in last 7 days',
   '{"editedWithin":"7d"}'::jsonb, true,
   'Items modified in the past week.',
   '{"visible":["updated"]}'::jsonb,
   'recent-edited-7d', 'recent-activity', 10)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  filter = EXCLUDED.filter,
  description = EXCLUDED.description,
  column_preferences = EXCLUDED.column_preferences,
  preset_group = EXCLUDED.preset_group,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO saved_searches (
  id, created_at, updated_at, owner_user_id,
  name, filter, is_system, description, column_preferences,
  slug, preset_group, sort_order
)
VALUES
  (gen_random_uuid(), now(), now(), NULL,
   'Edited since last sync',
   '{"editedSinceSync":true}'::jsonb, true,
   'Items whose row was touched after the mirror was last refreshed.',
   '{"visible":["updated"]}'::jsonb,
   'recent-edited-since-sync', 'recent-activity', 20)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  filter = EXCLUDED.filter,
  description = EXCLUDED.description,
  column_preferences = EXCLUDED.column_preferences,
  preset_group = EXCLUDED.preset_group,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO saved_searches (
  id, created_at, updated_at, owner_user_id,
  name, filter, is_system, description, column_preferences,
  slug, preset_group, sort_order
)
VALUES
  (gen_random_uuid(), now(), now(), NULL,
   'Used textbooks only',
   '{"itemType":"used_textbook"}'::jsonb, true,
   'Only used-copy textbook SKUs.',
   '{"visible":["est_sales"]}'::jsonb,
   'textbook-used-only', 'textbook', 10)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  filter = EXCLUDED.filter,
  description = EXCLUDED.description,
  column_preferences = EXCLUDED.column_preferences,
  preset_group = EXCLUDED.preset_group,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();
