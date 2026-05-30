import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

// Handle hot-reloading in development and serverless in production
if (process.env.NODE_ENV === 'production') {
  // In serverless (Vercel), ensure connections are properly managed
  db.$connect().catch(() => {})
}
