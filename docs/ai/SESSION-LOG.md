# Session Log

## 2026-04-04

- Investigated the missing production Supabase behavior and confirmed it was not a full git revert.
- Verified the real production bug was missing build-time `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in the Docker build.
- Deployed:
  - `062d56f` — build wiring and diagnostics
  - `84fbefc` — scheduler inspection endpoint
  - `e665c93` — app-cron safety fallback until Supabase scheduler confirmation
- Verified production `/api/version` on `e665c93`.
- Verified the remaining blocker is `permission denied for schema cron` when the app role inspects Supabase scheduler state.
- Added shared Postgres-backed rate limiting for login and chat.
- Added DB-backed job run tracking surfaced in admin Database Health.
- Added legacy document audit tooling and explicit `ALLOW_LEGACY_FILESYSTEM_FALLBACK` control.
