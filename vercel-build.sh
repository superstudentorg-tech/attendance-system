#!/bin/bash
set -e

# Copy PostgreSQL schema for Vercel deployment
cp prisma/schema.prod.prisma prisma/schema.prisma

# Generate Prisma client
npx prisma generate

# Run migrations if available, otherwise push
# npx prisma migrate deploy 2>/dev/null || npx prisma db push --accept-data-loss 2>/dev/null || true

# Build Next.js
npx next build
