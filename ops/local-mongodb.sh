#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
mongod="$root/.tools/mongodb/bin/mongod"
data="$root/.data/mongodb"
pid="$data/mongod.pid"
log="$data/mongod.log"
mkdir -p "$data"
case "${1:-}" in
  start) "$mongod" --dbpath "$data" --bind_ip 127.0.0.1 --port 27018 --replSet rs0 --fork --logpath "$log" --pidfilepath "$pid" ;;
  stop) "$mongod" --dbpath "$data" --shutdown ;;
  status) [[ -f "$pid" ]] && kill -0 "$(cat "$pid")" && printf 'MongoDB is running on port 27018.\n' ;;
  *) printf 'usage: %s {start|stop|status}\n' "$0" >&2; exit 2 ;;
esac
