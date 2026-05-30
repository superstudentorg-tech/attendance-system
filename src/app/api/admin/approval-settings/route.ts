import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');

    if (!companyId) {
      return NextResponse.json({ error: 'معرف الشركة مطلوب' }, { status: 400 });
    }

    const settings = await db.approvalSetting.findMany({
      where: { companyId },
      include: {
        approver: { select: { id: true, name: true, position: true, department: true } },
      },
      orderBy: [{ category: 'asc' }, { requestType: 'asc' }],
    });

    return NextResponse.json({ settings });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { companyId, category, requestType, approverId } = await request.json();

    if (!companyId || !category || !requestType || !approverId) {
      return NextResponse.json({ error: 'جميع البيانات مطلوبة' }, { status: 400 });
    }

    // Upsert: create or update if exists
    const setting = await db.approvalSetting.upsert({
      where: {
        companyId_category_requestType: { companyId, category, requestType }
      },
      create: { companyId, category, requestType, approverId },
      update: { approverId },
      include: {
        approver: { select: { id: true, name: true, position: true } },
      }
    });

    return NextResponse.json({ message: 'تم حفظ إعدادات الاعتماد بنجاح', setting });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'حدث خطأ أثناء حفظ الإعدادات' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'معرف الإعداد مطلوب' }, { status: 400 });
    }

    await db.approvalSetting.delete({ where: { id } });
    return NextResponse.json({ message: 'تم حذف الإعداد بنجاح' });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'حدث خطأ أثناء حذف الإعداد' }, { status: 500 });
  }
}
