import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const company = await db.company.findFirst({
      include: { branches: true }
    });

    if (!company) {
      return NextResponse.json({ error: 'لا توجد شركة مسجلة' }, { status: 404 });
    }

    return NextResponse.json({ company });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}
