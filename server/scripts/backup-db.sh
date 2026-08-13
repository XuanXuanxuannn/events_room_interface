#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DATA_DIR="${DATA_DIR:-$ROOT_DIR/storage}"
BACKUP_ROOT="${BACKUP_DIR:-$ROOT_DIR/storage/backups}"
STAMP="$(date +%Y%m%d-%H%M%S)"
DEST="$BACKUP_ROOT/$STAMP"

mkdir -p "$DEST"
if [[ -f "$DATA_DIR/app.db" ]]; then
  cp "$DATA_DIR/app.db" "$DEST/app.db"
  # best-effort WAL checkpoint companions
  [[ -f "$DATA_DIR/app.db-wal" ]] && cp "$DATA_DIR/app.db-wal" "$DEST/app.db-wal" || true
  [[ -f "$DATA_DIR/app.db-shm" ]] && cp "$DATA_DIR/app.db-shm" "$DEST/app.db-shm" || true
fi

mkdir -p "$DEST/uploads" "$DEST/presentations" "$DEST/converted"
rsync -a --ignore-errors "$DATA_DIR/uploads/" "$DEST/uploads/" 2>/dev/null || true
rsync -a --ignore-errors "$DATA_DIR/presentations/" "$DEST/presentations/" 2>/dev/null || true
rsync -a --ignore-errors "$DATA_DIR/converted/" "$DEST/converted/" 2>/dev/null || true

echo "Backup written to $DEST"
