#!/usr/bin/env bash
set -euo pipefail

backup="${1:?usage: verify-backup.sh BACKUP.dump}"
test -s "$backup"
if [[ -f "$backup.sha256" ]]; then
  (cd "$(dirname "$backup")" && sha256sum --check "$(basename "$backup").sha256")
fi
entries="$(pg_restore --list "$backup" | awk '!/^;/ { count++ } END { print count+0 }')"
if [[ "$entries" -lt 1 ]]; then
  printf 'Backup contains no restorable entries\n' >&2
  exit 1
fi
printf 'Backup verified: %s restorable entries\n' "$entries"
