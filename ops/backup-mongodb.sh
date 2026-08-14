#!/usr/bin/env bash
set -euo pipefail
: "${DATABASE_URL:?DATABASE_URL is required}"
backup_dir="${BACKUP_DIR:-./backups}"
mkdir -p "$backup_dir"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
archive="$backup_dir/nyumbapap-$timestamp.archive.gz"
mongodump --uri="$DATABASE_URL" --archive="$archive" --gzip
printf 'MongoDB backup written to %s\n' "$archive"
