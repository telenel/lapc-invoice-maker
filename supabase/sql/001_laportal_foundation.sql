-- LAPortal Supabase foundation bootstrap
-- Apply this in Supabase SQL Editor before enabling private Realtime channels
-- and Storage-backed document persistence in the application.

insert into storage.buckets (id, name, public)
values ('laportal-documents', 'laportal-documents', false)
on conflict (id) do nothing;

alter table realtime.messages enable row level security;

drop policy if exists "laportal global realtime select" on realtime.messages;
create policy "laportal global realtime select"
on realtime.messages
for select
to authenticated
using (
  realtime.topic() = 'app:global'
  or realtime.topic() = 'user:' || (select auth.uid())::text
);

drop policy if exists "laportal global realtime insert" on realtime.messages;
create policy "laportal global realtime insert"
on realtime.messages
for insert
to authenticated
with check (
  realtime.topic() = 'app:global'
  or realtime.topic() = 'user:' || (select auth.uid())::text
);
