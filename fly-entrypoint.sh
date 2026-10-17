#!/bin/sh
set -e

DATA_DIR=/data
SEED_DIR=/app/extracted/pb_data

if [ ! -f "$DATA_DIR/data.db" ]; then
  echo "[entrypoint] No existing data.db found - seeding from pb_data..."
  mkdir -p "$DATA_DIR"
  cp -a "$SEED_DIR"/. "$DATA_DIR"/
  echo "[entrypoint] Seed complete."
else
  echo "[entrypoint] Existing data.db found - keeping it as-is."
fi

exec /app/extracted/pocketbase serve \
  --http=0.0.0.0:8080 \
  --dir="$DATA_DIR" \
  --migrationsDir=/app/extracted/pb_migrations \
  --hooksDir=/app/extracted/pb_hooks \
  --hooksWatch=false \
  --publicDir=/app/extracted/pb_public
