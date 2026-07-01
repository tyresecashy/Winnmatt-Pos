#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="./backups"
mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILENAME="winnmatt-pos-${TIMESTAMP}.sql"

if [ -z "${SUPABASE_DB_URL:-}" ]; then
  echo "ERROR: SUPABASE_DB_URL environment variable not set."
  echo "Usage: SUPABASE_DB_URL=postgresql://user:pass@host:5432/db $0"
  exit 1
fi

echo "Backing up database to $BACKUP_DIR/$FILENAME ..."
pg_dump "$SUPABASE_DB_URL" --clean --if-exists --no-owner > "$BACKUP_DIR/$FILENAME"

echo "Backup complete: $BACKUP_DIR/$FILENAME"
