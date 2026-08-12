#!/usr/bin/env bash
set -euo pipefail

: "${DR_RESTORE_DATABASE_URL:?DR_RESTORE_DATABASE_URL must point to a disposable empty drill database}"
backup="${1:?usage: dr-drill.sh BACKUP.dump}"
database_name="$(psql "$DR_RESTORE_DATABASE_URL" -Atqc 'select current_database()')"
if [[ ! "$database_name" =~ (_dr_|_dr$|^dr_) ]]; then
  printf 'Refusing restore: database name %q is not clearly marked as a DR database\n' "$database_name" >&2
  exit 1
fi
if [[ "${DR_CONFIRM:-}" != "RESTORE_DISPOSABLE_DATABASE" ]]; then
  printf 'Set DR_CONFIRM=RESTORE_DISPOSABLE_DATABASE to confirm destructive restore into %s\n' "$database_name" >&2
  exit 1
fi

started="$(date +%s)"
"$(dirname "$0")/verify-backup.sh" "$backup"
pg_restore --dbname="$DR_RESTORE_DATABASE_URL" --clean --if-exists --no-owner --no-acl "$backup"
relation_count="$(psql "$DR_RESTORE_DATABASE_URL" -v ON_ERROR_STOP=1 -Atqc "
  select count(*) from unnest(array['users','listings','payments','audit_events','notification_outbox']) name
  where to_regclass('public.' || name) is not null;
")"
if [[ "$relation_count" != "5" ]]; then
  printf 'Restore validation failed: only %s of 5 critical relations exist\n' "$relation_count" >&2
  exit 1
fi
psql "$DR_RESTORE_DATABASE_URL" -v ON_ERROR_STOP=1 -Atqc "
  select 'users=' || count(*) from users;
  select 'listings=' || count(*) from listings;
  select 'payments=' || count(*) from payments;
" 
finished="$(date +%s)"
printf 'DR restore drill passed for %s in %ss\n' "$database_name" "$((finished-started))"
