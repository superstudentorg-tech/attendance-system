import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    if (!companyId) return NextResponse.json({ error: 'معرف الشركة مطلوب' }, { status: 400 });

    const settings = await db.approvalSetting.findMany({
      where: { companyId },
      include: { approver: { select: { id: true, name: true, position: true } } },
      orderBy: { category: 'asc' },
    });
    return NextResponse.json({ settings });
  } catch (error) { console.error(error); return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 }); }
}

export async function POST(request: Request) {
  try {
    const { companyId, category, requestType, level, approverId } = await request.json();
    if (!companyId || !category || !requestType || !level || !approverId) {
      return NextResponse.json({ error: 'جميع البيانات مطلوبة' }, { status: 400 });
    }

    const setting = await db.approvalSetting.upsert({
      where: { companyId_category_requestType_level: { companyId, category, requestType, level: parseInt(level) } },
      create: { companyId, category, requestType, level: parseInt(level), approverId },
      update: { approverId },
      include: { approver: { select: { id: true, name: true, position: true } } }
    });

    return NextResponse.json({ message: 'تم حفظ إعدادات الاعتماد بنجاح', setting });
  } catch (error) { console.error(error); return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 }); }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'معرف الإعداد مطلوب' }, { status: 400 });
    await db.approvalSetting.delete({ where: { id } });
    return NextResponse.json({ message: 'تم حذف الإعداد بنجاح' });
  } catch (error) { console.error(error); return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 }); }
}
