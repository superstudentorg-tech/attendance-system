import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { type, id, approvedById } = await request.json();

    if (!type || !id || !approvedById) {
      return NextResponse.json({ error: 'جميع البيانات مطلوبة' }, { status: 400 });
    }

    const status = type === 'approve' ? 'approved' : 'rejected';

    // Try leave request
    const leave = await db.leaveRequest.findUnique({
      where: { id },
      include: { employee: { select: { name: true } } }
    });
    if (leave) {
      const updated = await db.leaveRequest.update({
        where: { id },
        data: { status, approvedById, approvedAt: new Date() },
        include: { employee: { select: { name: true } } }
      });
      return NextResponse.json({
        message: status === 'approved' ? `تم اعتماد طلب اجازة ${updated.employee?.name}` : `تم رفض طلب اجازة ${updated.employee?.name}`,
        request: updated
      });
    }

    // Try permission request
    const permission = await db.permissionRequest.findUnique({
      where: { id },
      include: { employee: { select: { name: true } } }
    });
    if (permission) {
      const updated = await db.permissionRequest.update({
        where: { id },
        data: { status, approvedById, approvedAt: new Date() },
        include: { employee: { select: { name: true } } }
      });
      return NextResponse.json({
        message: status === 'approved' ? `تم اعتماد طلب إذن ${updated.employee?.name}` : `تم رفض طلب إذن ${updated.employee?.name}`,
        request: updated
      });
    }

    return NextResponse.json({ error: 'الطلب غير موجود' }, { status: 404 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}
