#!/bin/sh
set -e

# Apply pending Prisma migrations to the connected database, then start Next.js.
echo "==> Running database migrations..."
npx prisma migrate deploy

echo "==> Starting Next.js production server..."
exec npm run start
