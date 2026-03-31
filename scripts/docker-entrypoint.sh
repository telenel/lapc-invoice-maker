#!/bin/sh
set -eu

DEFAULT_CMD='npx prisma migrate deploy && node server.js'

mkdir -p /app/data/pdfs /app/public/uploads

if [ "$(id -u)" = "0" ]; then
  chown -R app:app /app/data /app/public/uploads
  if [ "$#" -gt 0 ]; then
    exec su app -s /bin/sh -c "$*"
  fi
  exec su app -s /bin/sh -c "$DEFAULT_CMD"
fi

if [ "$#" -gt 0 ]; then
  exec "$@"
fi

exec sh -lc "$DEFAULT_CMD"
