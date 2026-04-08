#!/bin/sh
set -eu

DEFAULT_CMD='npx prisma migrate deploy && node server.js'

write_build_meta() {
  build_sha="${BUILD_SHA:-${NEXT_PUBLIC_BUILD_SHA:-dev}}"
  build_time="${BUILD_TIME:-${NEXT_PUBLIC_BUILD_TIME:-unknown}}"
  supabase_url_configured=false
  supabase_anon_key_configured=false

  if [ -n "${NEXT_PUBLIC_SUPABASE_URL:-}" ]; then
    supabase_url_configured=true
  fi

  if [ -n "${NEXT_PUBLIC_SUPABASE_ANON_KEY:-}" ]; then
    supabase_anon_key_configured=true
  fi

  cat > /app/.build-meta.json <<EOF
{"buildSha":"$build_sha","buildTime":"$build_time","publicEnv":{"supabaseUrlConfigured":$supabase_url_configured,"supabaseAnonKeyConfigured":$supabase_anon_key_configured}}
EOF
}

write_build_meta

if [ "$(id -u)" = "0" ]; then
  if [ "$#" -gt 0 ]; then
    exec su app -s /bin/sh -c "$*"
  fi
  exec su app -s /bin/sh -c "$DEFAULT_CMD"
fi

if [ "$#" -gt 0 ]; then
  exec "$@"
fi

exec sh -lc "$DEFAULT_CMD"
