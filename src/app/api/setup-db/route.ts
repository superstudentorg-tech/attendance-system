import { NextResponse } from 'next/server';
import { execSync } from 'child_process';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const companyCount = await db.company.count().catch(() => -1);
    if (companyCount >= 0) {
      return NextResponse.json({ status: 'ok', message: 'جداول قاعدة البيانات موجودة', companyCount });
    }
    return NextResponse.json({ status: 'error', message: 'جداول قاعدة البيانات غير موجودة' });
  } catch (error) {
    return NextResponse.json({ status: 'error', error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}

export async function POST() {
  try {
    execSync('npx prisma db push --accept-data-loss --skip-generate', { stdio: 'pipe', timeout: 60000, env: { ...process.env } });
    return NextResponse.json({ status: 'ok', message: 'تم إنشاء جداول قاعدة البيانات بنجاح' });
  } catch (error) {
    return NextResponse.json({ status: 'error', error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
