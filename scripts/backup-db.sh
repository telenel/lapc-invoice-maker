#!/bin/bash
BACKUP_DIR="/opt/backups/lapc-invoice-maker"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/invoicemaker_$TIMESTAMP.sql.gz"

mkdir -p "$BACKUP_DIR"

# Dump from the Docker PostgreSQL container
docker exec lapc-invoice-maker-db-1 pg_dump -U invoicemaker invoicemaker | gzip > "$BACKUP_FILE"

if [ $? -eq 0 ] && [ -s "$BACKUP_FILE" ]; then
  echo "$(date): Backup complete: $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))"
else
  echo "$(date): Backup FAILED"
  rm -f "$BACKUP_FILE"
  exit 1
fi

# Keep only last 15 backups
ls -t "$BACKUP_DIR"/invoicemaker_*.sql.gz | tail -n +16 | xargs -r rm

echo "$(date): Retention cleanup done. $(ls "$BACKUP_DIR"/invoicemaker_*.sql.gz | wc -l) backups retained."
