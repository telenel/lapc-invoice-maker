#!/bin/bash
BACKUP_DIR="/opt/backups/lapc-invoice-maker"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_SUBDIR="$BACKUP_DIR/$TIMESTAMP"
DB_FILE="$BACKUP_SUBDIR/database.sql.gz"

mkdir -p "$BACKUP_SUBDIR"

# 1. Dump the PostgreSQL database
echo "$(date): Starting database dump..."
docker exec lapc-invoice-maker-db-1 pg_dump -U invoicemaker invoicemaker | gzip > "$DB_FILE"

if [ $? -ne 0 ] || [ ! -s "$DB_FILE" ]; then
  echo "$(date): Database backup FAILED"
  rm -rf "$BACKUP_SUBDIR"
  exit 1
fi
echo "$(date): Database dump complete ($(du -h "$DB_FILE" | cut -f1))"

# 2. Backup generated PDFs from the Docker volume
echo "$(date): Backing up PDF files..."
docker cp lapc-invoice-maker-app-1:/app/data/pdfs "$BACKUP_SUBDIR/pdfs" 2>/dev/null || mkdir -p "$BACKUP_SUBDIR/pdfs"
PDF_COUNT=$(find "$BACKUP_SUBDIR/pdfs" -name "*.pdf" 2>/dev/null | wc -l)
echo "$(date): Backed up $PDF_COUNT PDF files"

# 3. Backup uploaded PrismCore files from the Docker volume
echo "$(date): Backing up uploaded files..."
docker cp lapc-invoice-maker-app-1:/app/public/uploads "$BACKUP_SUBDIR/uploads" 2>/dev/null || mkdir -p "$BACKUP_SUBDIR/uploads"
UPLOAD_COUNT=$(find "$BACKUP_SUBDIR/uploads" -type f 2>/dev/null | wc -l)
echo "$(date): Backed up $UPLOAD_COUNT uploaded files"

# 4. Compress the entire backup directory into a single archive
ARCHIVE="$BACKUP_DIR/backup_$TIMESTAMP.tar.gz"
tar -czf "$ARCHIVE" -C "$BACKUP_DIR" "$TIMESTAMP"
rm -rf "$BACKUP_SUBDIR"

ARCHIVE_SIZE=$(du -h "$ARCHIVE" | cut -f1)
echo "$(date): Full backup complete: $ARCHIVE ($ARCHIVE_SIZE)"

# 5. Keep only last 15 backups
ls -t "$BACKUP_DIR"/backup_*.tar.gz 2>/dev/null | tail -n +16 | xargs -r rm
RETAINED=$(ls "$BACKUP_DIR"/backup_*.tar.gz 2>/dev/null | wc -l)
echo "$(date): Retention cleanup done. $RETAINED backups retained."
