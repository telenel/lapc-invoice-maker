-- Configure Supabase-managed job scheduling for LAPortal.
-- Replace the placeholder values before executing.
-- This schedules Supabase pg_cron jobs that call the authenticated internal
-- Next.js job routes, so the business logic stays in the app while
-- orchestration moves onto Supabase.

create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists vault;

select vault.create_secret('https://laportal.example.com', 'laportal_app_url');
select vault.create_secret('replace-with-the-same-cron-secret-used-by-the-app', 'laportal_cron_secret');

select cron.schedule(
  'laportal-event-reminders',
  '*/15 * * * *',
  $$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'laportal_app_url') || '/api/internal/jobs/event-reminders',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'laportal_cron_secret')
      ),
      body := jsonb_build_object('source', 'supabase-cron')
    );
  $$
);

select cron.schedule(
  'laportal-payment-follow-ups',
  '0 16 * * 1-5',
  $$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'laportal_app_url') || '/api/internal/jobs/payment-follow-ups',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'laportal_cron_secret')
      ),
      body := jsonb_build_object('source', 'supabase-cron')
    );
  $$
);
