#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cluster="$root/.data/postgres"
log="$cluster/server.log"

case "${1:-}" in
  start)
    if pg_ctl -D "$cluster" status >/dev/null 2>&1; then
      printf 'NyumbaPap PostgreSQL is already running on port 5433.\n'
    else
      pg_ctl -D "$cluster" -l "$log" start
    fi
    ;;
  stop)
    pg_ctl -D "$cluster" stop
    ;;
  status)
    pg_ctl -D "$cluster" status
    ;;
  *)
    printf 'usage: %s {start|stop|status}\n' "$0" >&2
    exit 2
    ;;
esac
