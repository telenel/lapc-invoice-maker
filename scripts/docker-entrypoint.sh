#!/bin/sh
set -eu

DEFAULT_CMD='npx prisma migrate deploy && node server.js'

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
