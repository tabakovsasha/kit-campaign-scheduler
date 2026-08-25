#!/bin/sh
set -e

echo "[backend] Applying Prisma migrations..."
npx prisma migrate deploy --schema=prisma/schema.prisma

echo "[backend] Starting NestJS server..."
exec node dist/main.js
