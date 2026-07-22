#!/bin/bash

# EZTODO Database Backup Script
# Usage: ./backup-db.sh [backup_dir]

set -e

# Configuration
BACKUP_DIR="${1:-./backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="eztodo_backup_${TIMESTAMP}.sql"
CONTAINER_NAME="eztodo-postgres"
DB_NAME="eztodo"
DB_USER="eztodo"

# Create backup directory if not exists
mkdir -p "$BACKUP_DIR"

echo "Starting database backup..."

# Execute backup inside container
docker exec -t "$CONTAINER_NAME" pg_dump -U "$DB_USER" -d "$DB_NAME" -F p > "$BACKUP_DIR/$BACKUP_FILE"

# Compress backup
gzip "$BACKUP_DIR/$BACKUP_FILE"

echo "Backup completed: $BACKUP_DIR/${BACKUP_FILE}.gz"

# Cleanup old backups (keep last 7 days)
find "$BACKUP_DIR" -name "eztodo_backup_*.sql.gz" -mtime +7 -delete

echo "Old backups cleaned up."
