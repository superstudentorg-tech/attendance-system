#!/bin/bash
# Build script for Vercel deployment
# This script switches Prisma to PostgreSQL schema before building

echo "🔄 Preparing for Vercel build..."

# Copy PostgreSQL schema for Vercel
cp prisma/vercel/schema.prisma prisma/schema.prisma

echo "✅ PostgreSQL schema activated"
echo "📦 Running prisma generate..."
npx prisma generate

echo "🏗️ Building Next.js..."
next build

echo "✅ Build complete!"
